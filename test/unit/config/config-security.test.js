/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const sinon = require('sinon')
const Config = require('../../../lib/config')
const securityPolicies = require('../../lib/fixtures').securityPolicies
const { idempotentEnv } = require('./helper')

tap.test('should pick up the security policies token', (t) => {
  idempotentEnv({ NEW_RELIC_SECURITY_POLICIES_TOKEN: 'super secure' }, (tc) => {
    t.ok(tc.security_policies_token)
    t.equal(tc.security_policies_token, 'super secure')
    t.end()
  })
})

tap.test('should throw with both high_security and security_policies_token defined', (t) => {
  t.throws(function testInitialize() {
    Config.initialize({
      high_security: true,
      security_policies_token: 'fffff'
    })
  })

  t.end()
})

tap.test('should enable high security mode (HSM) with non-bool truthy HSM setting', (t) => {
  const applyHSM = Config.prototype._applyHighSecurity

  let hsmApplied = false
  Config.prototype._applyHighSecurity = () => {
    hsmApplied = true
  }
  const config = Config.initialize({
    high_security: 'true'
  })

  t.equal(!!config.high_security, true)
  t.equal(hsmApplied, true)

  Config.prototype._applyHighSecurity = applyHSM

  t.end()
})

tap.test('#_getMostSecure', (t) => {
  t.autoend()

  let config = null

  t.beforeEach(() => {
    config = new Config()
    config.security_policies_token = 'TEST-TEST-TEST-TEST'
  })

  t.test('returns the new value if the current one is undefined', (t) => {
    const val = config._getMostSecure('record_sql', undefined, 'off')
    t.equal(val, 'off')
    t.end()
  })

  t.test('returns the most strict if it does not know either value', (t) => {
    const val = config._getMostSecure('record_sql', undefined, 'dunno')
    t.equal(val, 'off')
    t.end()
  })

  t.test('should work as a pass through for unknown config options', (t) => {
    const val = config._getMostSecure('unknown.option', undefined, 'dunno')
    t.equal(val, 'dunno')
    t.end()
  })
})

tap.test('#applyLasp', (t) => {
  t.autoend()

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

  t.test('returns null if LASP is not enabled', (t) => {
    config.security_policies_token = ''

    const res = config.applyLasp(agent, {})
    t.equal(res.payload, null)
    t.end()
  })

  t.test('returns fatal response if required policy is not implemented or unknown', (t) => {
    policies.job_arguments = { enabled: true, required: true }
    policies.test = { enabled: true, required: true }

    const response = config.applyLasp(agent, policies)
    t.equal(response.shouldShutdownRun(), true)
    t.end()
  })

  t.test('takes the most secure from local', (t) => {
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

    t.equal(config.transaction_tracer.record_sql, 'off')
    t.equal(agent._resetQueries.callCount, 0)
    t.equal(config.attributes.include_enabled, false)
    t.equal(agent.traces.clear.callCount, 0)
    t.equal(config.strip_exception_messages.enabled, true)
    t.equal(agent._resetErrors.callCount, 0)
    t.equal(config.api.custom_events_enabled, false)
    t.equal(agent._resetCustomEvents.callCount, 0)
    t.equal(config.api.custom_attributes_enabled, false)
    Object.keys(payload).forEach(function checkPolicy(key) {
      t.equal(payload[key].enabled, false)
    })

    t.end()
  })

  t.test('takes the most secure from lasp', (t) => {
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

    t.equal(config.transaction_tracer.record_sql, 'off')
    t.equal(agent._resetQueries.callCount, 1)
    t.equal(config.attributes.include_enabled, false)
    t.same(config.attributes.exclude, ['request.parameters.*'])
    t.equal(config.strip_exception_messages.enabled, true)
    t.equal(agent._resetErrors.callCount, 1)
    t.equal(config.api.custom_events_enabled, false)
    t.equal(agent._resetCustomEvents.callCount, 1)
    t.equal(config.api.custom_attributes_enabled, false)
    t.equal(agent.traces.clear.callCount, 1)
    Object.keys(payload).forEach(function checkPolicy(key) {
      t.equal(payload[key].enabled, false)
    })

    t.end()
  })

  t.test('allows permissive settings', (t) => {
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

    t.equal(config.transaction_tracer.record_sql, 'obfuscated')
    t.equal(config.attributes.include_enabled, true)
    t.equal(config.strip_exception_messages.enabled, false)
    t.equal(config.api.custom_events_enabled, true)
    t.equal(config.api.custom_attributes_enabled, true)
    Object.keys(payload).forEach(function checkPolicy(key) {
      t.equal(payload[key].enabled, true)
    })

    t.end()
  })

  t.test('returns fatal response if expected policy is not received', (t) => {
    delete policies.record_sql

    const response = config.applyLasp(agent, policies)
    t.equal(response.shouldShutdownRun(), true)

    t.end()
  })

  t.test('should return known policies', (t) => {
    const response = config.applyLasp(agent, policies)
    t.same(response.payload, {
      record_sql: { enabled: false, required: false },
      attributes_include: { enabled: false, required: false },
      allow_raw_exception_messages: { enabled: false, required: false },
      custom_events: { enabled: false, required: false },
      custom_parameters: { enabled: false, required: false }
    })

    t.end()
  })
})
