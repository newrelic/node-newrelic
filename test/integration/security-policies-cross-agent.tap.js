/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const nock = require('nock')

const helper = require('../lib/agent_helper')
const testCases = require('../lib/cross_agent_tests/lasp/language_agents_security_policies.json')

const LASP_MAP = require('../../lib/config/lasp').LASP_MAP

const skipCases = []

const TEST_DOMAIN = 'test-collector.newrelic.com'
const TEST_COLLECTOR_URL = `https://${TEST_DOMAIN}`
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
  const reply = {
    return_value: {
      redirect_host: TEST_DOMAIN,
      security_policies: securityPolicies
    }
  }

  return reply
}

const CONNECT_REPLY = { return_value: { agent_run_id: RUN_ID } }

tap.test('LASP/CSP - Cross Agent Tests', (t) => {
  t.plan(testCases.length)

  let agent = null
  let preconnect = null
  let connect = null
  let connectBody = null

  function beforeTest(t, testCase) {
    const initialConfig = createTestConfiguration(t, testCase)
    agent = helper.loadMockedAgent(initialConfig)

    nock.disableNetConnect()

    const preconnectReply = getPreconnectReply(testCase.security_policies)
    preconnect = nockRequest('preconnect').reply(200, preconnectReply)

    if (!testCase.should_shutdown) {
      connect = nockRequest('connect', (body) => {
        connectBody = body
        // just take the failure via test framework instead of blowing up connection
        return true
      }).reply(200, CONNECT_REPLY)
    }
  }

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
    preconnect = null
    connect = null
    connectBody = null

    if (!nock.isDone()) {
      // eslint-disable-next-line no-console
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      nock.cleanAll()
    }

    nock.enableNetConnect()
  })

  testCases.forEach((testCase) => {
    const hasFeatures = hasRequiredFeatures(t, testCase.required_features)
    if (!hasFeatures) {
      t.comment('Agent does not support all required features for test, skipping.')
    }

    const manualSkip = skipCases.indexOf(testCase.name) >= 0
    if (manualSkip) {
      t.comment('Test configured in skipCases to be skipped.')
    }

    const options = {
      skip: !hasFeatures || manualSkip
    }

    t.test(testCase.name, options, (t) => {
      beforeTest(t, testCase)

      agent.start((error) => {
        t.ok(preconnect.isDone())

        if (!testCase.should_shutdown) {
          t.ok(connect.isDone())

          const connectData = connectBody[0]
          verifyConnectData(t, testCase, connectData)
        }

        verifyEndingConfigPolicySettings(t, testCase, agent.config)

        verifyAgentBehavior(t, testCase, agent, error)

        // These tests do not verify logging.
        t.end()
      })
    })
  })
})

function verifyConnectData(t, testCase, connectData) {
  t.ok(connectData.security_policies)

  for (const [policyName, expectedPolicy] of Object.entries(testCase.expected_connect_policies)) {
    const actualPolicy = connectData.security_policies[policyName]

    t.ok(actualPolicy)
    t.equal(actualPolicy.enabled, expectedPolicy.enabled)
  }

  for (const [, policyName] of testCase.validate_policies_not_in_connect.entries()) {
    const hasProperty = Object.hasOwnProperty.call(connectData.security_policies, policyName)
    t.notOk(hasProperty)
  }
}

function verifyEndingConfigPolicySettings(t, testCase, config) {
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

    t.equal(actual, expected)
  }
}

function verifyAgentBehavior(t, testCase, agent, error) {
  if (testCase.should_shutdown) {
    t.ok(error)
    const shutdownStates = ['stopped', 'disconnected', 'disconnecting', 'stopping', 'errored']
    const isShutdownState = shutdownStates.indexOf(agent._state) >= 0
    t.ok(isShutdownState)
  } else {
    t.error(error)
    t.equal(agent._state, 'started')
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

function createTestConfiguration(t, testCase) {
  const initialPolicies = testCase.starting_policy_settings
  const initialConfig = Object.assign({}, DEFAULT_CONFIG)

  for (const [policyName, policyValue] of Object.entries(initialPolicies)) {
    const policyMappings = LASP_MAP[policyName]
    const matchingConfigPath = policyMappings.path

    const settingValue = policyMappings.allowedValues[policyValue.enabled ? 1 : 0]

    t.comment(
      `${policyName}.enabled: ${policyValue.enabled} ` + `-> ${matchingConfigPath}: ${settingValue}`
    )

    initConfigurationItem(initialConfig, matchingConfigPath, settingValue)
  }

  return initialConfig
}

function hasRequiredFeatures(t, requiredFeatures) {
  const unsupportedFeatures = requiredFeatures.filter((featureName) => {
    const mapping = LASP_MAP[featureName]
    return mapping == null
  })

  if (unsupportedFeatures.length > 0) {
    const featureList = unsupportedFeatures.join(', ')
    t.comment(`Missing features: ${featureList}`)

    return false
  }

  return true
}

function nockRequest(endpointMethod, bodyMatcher) {
  const relativepath = helper.generateCollectorPath(endpointMethod)
  return nock(TEST_COLLECTOR_URL).post(relativepath, bodyMatcher)
}
