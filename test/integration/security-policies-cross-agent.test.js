/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { nockRequest } = require('./response-handling-utils')
const nock = require('nock')
const helper = require('../lib/agent_helper')
const testCases = require('../lib/cross_agent_tests/language_agents_security_policies.json')
const { LASP_MAP } = require('../../lib/config/lasp')
const TEST_DOMAIN = 'test-collector.newrelic.com'
const RUN_ID = 'runId'

const DEFAULT_CONFIG = {
  license_key: 'license key here',
  host: TEST_DOMAIN,
  security_policies_token: 'AAAA-TEST-TOKE-NNN',
  plugins: {
    // turn off native metrics to avoid unwanted gc metrics
    native_metrics: { enabled: false }
  },
  utilization: {
    detect_aws: false,
    detect_pcf: false,
    detect_azure: false,
    detect_gcp: false,
    detect_docker: false
  }
}

function getPreconnectReply(securityPolicies) {
  return {
    return_value: {
      redirect_host: TEST_DOMAIN,
      security_policies: securityPolicies
    }
  }
}

const CONNECT_REPLY = { return_value: { agent_run_id: RUN_ID } }

function beforeTest(t, testCase) {
  const initialConfig = createTestConfiguration(testCase)
  const agent = helper.loadMockedAgent(initialConfig)
  nock.disableNetConnect()

  const preconnectReply = getPreconnectReply(testCase.security_policies)
  const preconnect = nockRequest('preconnect').reply(200, preconnectReply)

  let connect
  if (!testCase.should_shutdown) {
    connect = nockRequest('connect', null, (body) => {
      t.nr.connectBody = body
      // just take the failure via test framework instead of blowing up connection
      return true
    }).reply(200, CONNECT_REPLY)
  }
  t.nr = {
    agent,
    connect,
    preconnect
  }
}

test('LASP/CSP - Cross Agent Tests', async (t) => {
  for (const testCase of testCases) {
    const isUnsupported = hasRequiredFeatures(testCase.required_features)
    const options = { skip: isUnsupported }

    await t.test(testCase.name, options, (t, end) => {
      beforeTest(t, testCase)
      const { agent, connect, preconnect } = t.nr
      t.after(() => {
        helper.unloadAgent(agent)
        if (!nock.isDone()) {
          console.error('Cleaning pending mocks: %j', nock.pendingMocks())
          nock.cleanAll()
        }

        nock.enableNetConnect()
      })

      agent.start((error) => {
        assert.ok(preconnect.isDone())

        if (!testCase.should_shutdown) {
          assert.ok(connect.isDone())

          const connectData = t.nr.connectBody[0]
          verifyConnectData(testCase, connectData)
        }

        verifyEndingConfigPolicySettings(testCase, agent.config)

        verifyAgentBehavior(testCase, agent, error)

        // These tests do not verify logging.
        end()
      })
    })
  }
})

function verifyConnectData(testCase, connectData) {
  assert.ok(connectData.security_policies)

  for (const [policyName, expectedPolicy] of Object.entries(testCase.expected_connect_policies)) {
    const actualPolicy = connectData.security_policies[policyName]

    assert.ok(actualPolicy)
    assert.equal(actualPolicy.enabled, expectedPolicy.enabled)
  }

  for (const [, policyName] of testCase.validate_policies_not_in_connect.entries()) {
    const hasProperty = Object.hasOwnProperty.call(connectData.security_policies, policyName)
    assert.ok(!hasProperty)
  }
}

function verifyEndingConfigPolicySettings(testCase, config) {
  for (const [policyName, policyValue] of Object.entries(testCase.ending_policy_settings)) {
    const matchingConfigPath = LASP_MAP[policyName].path

    const nestedSettingNames = matchingConfigPath.split('.')
    let value = null
    nestedSettingNames.forEach((settingName, index) => {
      if (index === 0) {
        value = config[settingName]
        return
      }

      value = value ? value[settingName] : value
    })

    // Translate back from config value to lasp value
    const allowedIndex = LASP_MAP[policyName].allowedValues.indexOf(value)
    const actual = allowedIndex >= 0 ? Boolean(allowedIndex) : value
    const expected = policyValue.enabled

    assert.equal(actual, expected)
  }
}

function verifyAgentBehavior(testCase, agent, error) {
  if (testCase.should_shutdown) {
    assert.ok(error)
    const shutdownStates = ['stopped', 'disconnected', 'disconnecting', 'stopping', 'errored']
    const isShutdownState = shutdownStates.indexOf(agent._state) >= 0
    assert.ok(isShutdownState)
  } else {
    assert.ok(!error)
    assert.equal(agent._state, 'started')
  }
}

function initConfigurationItem(config, path, value) {
  const nestedKeys = path.split('.')

  let nestedSetting = null
  nestedKeys.forEach((settingName, index) => {
    if (index === 0) {
      const configValue = config[settingName] || {}
      nestedSetting = config[settingName] = configValue
      return
    }

    if (index === nestedKeys.length - 1) {
      nestedSetting[settingName] = value
      return
    }

    const configValue = nestedSetting[settingName] || {}
    nestedSetting = nestedSetting[settingName] = configValue
  })
}

function createTestConfiguration(testCase) {
  const initialPolicies = testCase.starting_policy_settings
  const initialConfig = Object.assign({}, DEFAULT_CONFIG)

  for (const [policyName, policyValue] of Object.entries(initialPolicies)) {
    const policyMappings = LASP_MAP[policyName]
    const matchingConfigPath = policyMappings.path

    const settingValue = policyMappings.allowedValues[policyValue.enabled ? 1 : 0]

    initConfigurationItem(initialConfig, matchingConfigPath, settingValue)
  }

  return initialConfig
}

function hasRequiredFeatures(requiredFeatures) {
  const unsupportedFeatures = requiredFeatures.filter((featureName) => {
    const mapping = LASP_MAP[featureName]
    return mapping == null
  })

  return unsupportedFeatures.length > 0
}
