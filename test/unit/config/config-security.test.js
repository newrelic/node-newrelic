/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const Config = require('../../../lib/config')
const securityPolicies = require('../../lib/fixtures').securityPolicies
const { idempotentEnv } = require('./helper')

test('should pick up the security policies token', (t, end) => {
  idempotentEnv({ NEW_RELIC_SECURITY_POLICIES_TOKEN: 'super secure' }, (tc) => {
    assert.ok(tc.security_policies_token)
    assert.equal(tc.security_policies_token, 'super secure')
    end()
  })
})

test('should throw with both high_security and security_policies_token defined', () => {
  assert.throws(function testInitialize() {
    Config.initialize({
      high_security: true,
      security_policies_token: 'fffff'
    })
  })
})

test('should enable high security mode (HSM) with non-bool truthy HSM setting', () => {
  const applyHSM = Config.prototype._applyHighSecurity

  let hsmApplied = false
  Config.prototype._applyHighSecurity = () => {
    hsmApplied = true
  }
  const config = Config.initialize({
    high_security: 'true'
  })

  assert.equal(!!config.high_security, true)
  assert.equal(hsmApplied, true)

  Config.prototype._applyHighSecurity = applyHSM
})

test('#_getMostSecure', async (t) => {
  let config = null

  t.beforeEach(() => {
    config = new Config()
    config.security_policies_token = 'TEST-TEST-TEST-TEST'
  })

  await t.test('returns the new value if the current one is undefined', () => {
    const val = config._getMostSecure('record_sql', undefined, 'off')
    assert.equal(val, 'off')
  })

  await t.test('returns the most strict if it does not know either value', () => {
    const val = config._getMostSecure('record_sql', undefined, 'dunno')
    assert.equal(val, 'off')
  })

  await t.test('should work as a pass through for unknown config options', () => {
    const val = config._getMostSecure('unknown.option', undefined, 'dunno')
    assert.equal(val, 'dunno')
  })
})

test('#applyLasp', async (t) => {
  let config = null
  let policies = null
  let agent = null

  t.beforeEach(() => {
    agent = {
      _resetErrors: sinon.spy(),
      _resetCustomEvents: sinon.spy(),
      _resetQueries: sinon.spy(),
      traces: {
        clear: sinon.spy()
      }
    }
    agent.config = config = new Config()
    config.security_policies_token = 'TEST-TEST-TEST-TEST'
    policies = securityPolicies()
  })

  await t.test('returns null if LASP is not enabled', () => {
    config.security_policies_token = ''

    const res = config.applyLasp(agent, {})
    assert.equal(res.payload, null)
  })

  await t.test('returns fatal response if required policy is not implemented or unknown', () => {
    policies.job_arguments = { enabled: true, required: true }
    policies.test = { enabled: true, required: true }

    const response = config.applyLasp(agent, policies)
    assert.equal(response.shouldShutdownRun(), true)
  })

  await t.test('takes the most secure from local', () => {
    config.transaction_tracer.record_sql = 'off'
    config.attributes.include_enabled = false
    config.strip_exception_messages.enabled = true
    config.api.custom_events_enabled = false
    config.api.custom_attributes_enabled = false

    Object.keys(policies).forEach(function enablePolicy(key) {
      policies[key].enabled = true
    })

    const response = config.applyLasp(agent, policies)
    const payload = response.payload

    assert.equal(config.transaction_tracer.record_sql, 'off')
    assert.equal(agent._resetQueries.callCount, 0)
    assert.equal(config.attributes.include_enabled, false)
    assert.equal(agent.traces.clear.callCount, 0)
    assert.equal(config.strip_exception_messages.enabled, true)
    assert.equal(agent._resetErrors.callCount, 0)
    assert.equal(config.api.custom_events_enabled, false)
    assert.equal(agent._resetCustomEvents.callCount, 0)
    assert.equal(config.api.custom_attributes_enabled, false)
    Object.keys(payload).forEach(function checkPolicy(key) {
      assert.equal(payload[key].enabled, false)
    })
  })

  await t.test('takes the most secure from lasp', () => {
    config.transaction_tracer.record_sql = 'obfuscated'
    config.attributes.include_enabled = true
    config.strip_exception_messages.enabled = false
    config.api.custom_events_enabled = true
    config.api.custom_attributes_enabled = true

    Object.keys(policies).forEach(function enablePolicy(key) {
      policies[key].enabled = false
    })

    const response = config.applyLasp(agent, policies)
    const payload = response.payload

    assert.equal(config.transaction_tracer.record_sql, 'off')
    assert.equal(agent._resetQueries.callCount, 1)
    assert.equal(config.attributes.include_enabled, false)
    assert.deepStrictEqual(config.attributes.exclude, ['request.parameters.*'])
    assert.equal(config.strip_exception_messages.enabled, true)
    assert.equal(agent._resetErrors.callCount, 1)
    assert.equal(config.api.custom_events_enabled, false)
    assert.equal(agent._resetCustomEvents.callCount, 1)
    assert.equal(config.api.custom_attributes_enabled, false)
    assert.equal(agent.traces.clear.callCount, 1)
    Object.keys(payload).forEach(function checkPolicy(key) {
      assert.equal(payload[key].enabled, false)
    })
  })

  await t.test('allows permissive settings', () => {
    config.transaction_tracer.record_sql = 'obfuscated'
    config.attributes.include_enabled = true
    config.strip_exception_messages.enabled = false
    config.api.custom_events_enabled = true
    config.api.custom_attributes_enabled = true

    Object.keys(policies).forEach(function enablePolicy(key) {
      policies[key].enabled = true
    })

    const response = config.applyLasp(agent, policies)
    const payload = response.payload

    assert.equal(config.transaction_tracer.record_sql, 'obfuscated')
    assert.equal(config.attributes.include_enabled, true)
    assert.equal(config.strip_exception_messages.enabled, false)
    assert.equal(config.api.custom_events_enabled, true)
    assert.equal(config.api.custom_attributes_enabled, true)
    Object.keys(payload).forEach(function checkPolicy(key) {
      assert.equal(payload[key].enabled, true)
    })
  })

  await t.test('returns fatal response if expected policy is not received', () => {
    delete policies.record_sql

    const response = config.applyLasp(agent, policies)
    assert.equal(response.shouldShutdownRun(), true)
  })

  await t.test('should return known policies', () => {
    const response = config.applyLasp(agent, policies)
    assert.deepEqual(response.payload, {
      record_sql: { enabled: false, required: false },
      attributes_include: { enabled: false, required: false },
      allow_raw_exception_messages: { enabled: false, required: false },
      custom_events: { enabled: false, required: false },
      custom_parameters: { enabled: false, required: false }
    })
  })
})

test('ai_monitoring should not be enabled in HSM', () => {
  const config = Config.initialize({
    ai_monitoring: {
      enabled: true
    },
    high_security: 'true'
  })

  assert.equal(config.ai_monitoring.enabled, false)
})
