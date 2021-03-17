/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
tap.mochaGlobals()

const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const Config = require('../../../lib/config')
const securityPolicies = require('../../lib/fixtures').securityPolicies

tap.test('should pick up the security policies token', (t) => {
  idempotentEnv({'NEW_RELIC_SECURITY_POLICIES_TOKEN': 'super secure'}, (tc) => {
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

describe('#_getMostSecure', function() {
  var config

  beforeEach(function(done) {
    config = new Config()
    config.security_policies_token = 'TEST-TEST-TEST-TEST'
    done()
  })

  it('returns the new value if the current one is undefined', function() {
    var val = config._getMostSecure('record_sql', undefined, 'off')
    expect(val).to.equal('off')
  })

  it('returns the most strict if it does not know either value', function() {
    var val = config._getMostSecure('record_sql', undefined, 'dunno')
    expect(val).to.equal('off')
  })

  it('should work as a pass through for unknown config options', function() {
    var val = config._getMostSecure('unknown.option', undefined, 'dunno')
    expect(val).to.equal('dunno')
  })
})

describe('#applyLasp', function() {
  let config = null
  let policies = null
  let agent = null

  beforeEach(function(done) {
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
    done()
  })

  it('returns null if LASP is not enabled', () => {
    config.security_policies_token = ''

    const res = config.applyLasp(agent, {})
    expect(res.payload).to.be.null
  })

  it('returns fatal response if required policy is not implemented or unknown', () => {
    policies.job_arguments = { enabled: true, required: true }
    policies.test = { enabled: true, required: true }

    const response = config.applyLasp(agent, policies)
    expect(response.shouldShutdownRun()).to.be.true
  })

  it('takes the most secure from local', () => {
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

    expect(config.transaction_tracer.record_sql).to.equal('off')
    expect(agent._resetQueries.callCount).to.equal(0)
    expect(config.attributes.include_enabled).to.equal(false)
    expect(agent.traces.clear.callCount).to.equal(0)
    expect(config.strip_exception_messages.enabled).to.equal(true)
    expect(agent._resetErrors.callCount).to.equal(0)
    expect(config.api.custom_events_enabled).to.equal(false)
    expect(agent._resetCustomEvents.callCount).to.equal(0)
    expect(config.api.custom_attributes_enabled).to.equal(false)
    Object.keys(payload).forEach(function checkPolicy(key) {
      expect(payload[key].enabled).to.be.false
    })
  })

  it('takes the most secure from lasp', () => {
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

    expect(config.transaction_tracer.record_sql).to.equal('off')
    expect(agent._resetQueries.callCount).to.equal(1)
    expect(config.attributes.include_enabled).to.equal(false)
    expect(config.attributes.exclude).to.deep.equal(['request.parameters.*'])
    expect(config.strip_exception_messages.enabled).to.equal(true)
    expect(agent._resetErrors.callCount).to.equal(1)
    expect(config.api.custom_events_enabled).to.equal(false)
    expect(agent._resetCustomEvents.callCount).to.equal(1)
    expect(config.api.custom_attributes_enabled).to.equal(false)
    expect(agent.traces.clear.callCount).to.equal(1)
    Object.keys(payload).forEach(function checkPolicy(key) {
      expect(payload[key].enabled).to.be.false
    })
  })

  it('allow permissive settings', () => {
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

    expect(config.transaction_tracer.record_sql).to.equal('obfuscated')
    expect(config.attributes.include_enabled).to.equal(true)
    expect(config.strip_exception_messages.enabled).to.equal(false)
    expect(config.api.custom_events_enabled).to.equal(true)
    expect(config.api.custom_attributes_enabled).to.equal(true)
    Object.keys(payload).forEach(function checkPolicy(key) {
      expect(payload[key].enabled).to.be.true
    })
  })

  it('returns fatal response if expected policy is not received', () => {
    delete policies.record_sql

    const response = config.applyLasp(agent, policies)
    expect(response.shouldShutdownRun()).to.be.true
  })

  it('should return known policies', () => {
    const response = config.applyLasp(agent, policies)
    expect(response.payload).to.deep.equal({
      record_sql: { enabled: false, required: false },
      attributes_include: { enabled: false, required: false },
      allow_raw_exception_messages: { enabled: false, required: false },
      custom_events: { enabled: false, required: false },
      custom_parameters: { enabled: false, required: false }
    })
  })
})


// TODO: move to an env helper for import/reuse
function idempotentEnv(envConfig, initialConfig, callback) {
  let saved = {}

  // Allow idempotentEnv to be called w/o initialConfig
  if (typeof initialConfig === 'function') {
    callback = initialConfig
    initialConfig = {}
  }

  Object.keys(envConfig).forEach((key) => {
    // process.env is not a normal object
    if (Object.hasOwnProperty.call(process.env, key)) {
      saved[key] = process.env[key]
    }

    process.env[key] = envConfig[key]
  })
  try {
    const tc = Config.initialize(initialConfig)
    callback(tc)
  } finally {
    Object.keys(envConfig).forEach((finalKey) => {
      if (saved[finalKey]) {
        process.env[finalKey] = saved[finalKey]
      } else {
        delete process.env[finalKey]
      }
    })
  }
}
