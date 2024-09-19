/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { match } = require('../lib/custom-assertions')
const helper = require('../lib/agent_helper')
const facts = require('../../lib/collector/facts')
const API = require('../../api')
const Config = require('../../lib/config')

// simplified version of lodash set()
function setPath(obj, path, value) {
  const paths = path.split('.')
  while (paths.length - 1) {
    const key = paths.shift()
    if (!(key in obj)) {
      obj[key] = {}
    }
    obj = obj[key]
  }
  obj[paths[0]] = value
}

// simplified version of lodash get()
function getPath(obj, path) {
  const paths = path.split('.')
  while (paths.length - 1) {
    const key = paths.shift()
    obj = obj[key]
  }
  return obj[paths[0]]
}

function check(key, before, after) {
  const fromFile = { high_security: true }
  setPath(fromFile, key, before)

  const config = new Config(fromFile)
  return assert.equal(match(getPath(config, key), after), true)
}

function checkServer(config, key, expected, server) {
  setPath(config, key, expected)
  const fromServer = { high_security: true }
  fromServer[key] = server

  assert.equal(match(getPath(config, key), expected), true)
  assert.equal(match(fromServer[key], server), true)

  config.onConnect(fromServer)
  return assert.equal(match(getPath(config, key), expected), true)
}

test('config to be sent during connect', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should contain high_security', async (t) => {
    const { agent } = t.nr
    const factoids = await new Promise((resolve) => {
      facts(agent, resolve)
    })
    assert.ok(Object.keys(factoids).includes('high_security'))
  })
})

test('conditional application of server side settings', async (t) => {
  await t.test('when high_security === true', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.config = new Config({ high_security: true })
    })

    await t.test('should reject disabling ssl', (t) => {
      const { config } = t.nr
      checkServer(config, 'ssl', true, false)
    })

    await t.test('should reject enabling allow_all_headers', (t) => {
      const { config } = t.nr
      checkServer(config, 'allow_all_headers', false, true)
    })

    await t.test('should reject enabling slow_sql', (t) => {
      const { config } = t.nr
      checkServer(config, 'slow_sql.enabled', false, true)
    })

    await t.test('should not change attributes settings', (t) => {
      const { config } = t.nr
      checkServer(config, 'attributes.include', [], ['foobar'])
      checkServer(config, 'attributes.exclude', [], ['fizzbang', 'request.parameters.*'])
    })

    await t.test('should not change transaction_tracer settings', (t) => {
      const { config } = t.nr
      checkServer(config, 'transaction_tracer.record_sql', 'obfuscated', 'raw')
      checkServer(config, 'transaction_tracer.attributes.include', [], ['foobar'])
      checkServer(config, 'transaction_tracer.attributes.exclude', [], ['fizzbang'])
    })

    await t.test('should not change error_collector settings', (t) => {
      const { config } = t.nr
      checkServer(config, 'error_collector.attributes.include', [], ['foobar'])
      checkServer(config, 'error_collector.attributes.exclude', [], ['fizzbang'])
    })

    await t.test('should not change browser_monitoring settings', (t) => {
      const { config } = t.nr
      checkServer(config, 'browser_monitoring.attributes.include', [], ['foobar'])
      checkServer(config, 'browser_monitoring.attributes.exclude', [], ['fizzbang'])
    })

    await t.test('should not change transaction_events settings', (t) => {
      const { config } = t.nr
      checkServer(config, 'transaction_events.attributes.include', [], ['foobar'])
      checkServer(config, 'transaction_events.attributes.exclude', [], ['fizzbang'])
    })

    await t.test('should shut down the agent if high_security is false', (t) => {
      const { config } = t.nr
      config.onConnect({ high_security: false })
      assert.equal(config.agent_enabled, false)
    })

    await t.test('should shut down the agent if high_security is missing', (t) => {
      const { config } = t.nr
      config.onConnect({})
      assert.equal(config.agent_enabled, false)
    })

    await t.test('should disable application logging forwarding', (t) => {
      const { config } = t.nr
      checkServer(config, 'application_logging.forwarding.enabled', false, true)
    })
  })

  await t.test('when high_security === false', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.config = new Config({ high_security: false })
    })

    await t.test('should accept disabling ssl', (t) => {
      const { config } = t.nr
      // enabled by default, but lets make sure.
      config.ssl = true
      config.onConnect({ ssl: false })
      assert.equal(config.ssl, true)
    })
  })
})

test('coerces other settings', async (t) => {
  await t.test('coerces other settings', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}

      ctx.nr.orig = Config.prototype._applyHighSecurity
      ctx.nr.called = false
      Config.prototype._applyHighSecurity = () => {
        ctx.nr.called = true
      }
    })

    t.afterEach((ctx) => {
      Config.prototype._applyHighSecurity = ctx.nr.orig
    })

    await t.test('should call if high_security is on', (t) => {
      new Config({ high_security: true }) // eslint-disable-line no-new
      assert.equal(t.nr.called, true)
    })

    await t.test('should not call if high_security is off', (t) => {
      new Config({ high_security: false }) // eslint-disable-line no-new
      assert.equal(t.nr.called, false)
    })
  })

  await t.test('when high_security === true', async (t) => {
    await t.test('should detect that ssl is off', () => {
      check('ssl', false, true)
    })

    await t.test('should detect that allow_all_headers is on', () => {
      check('allow_all_headers', true, false)
    })

    await t.test('should change attributes settings', () => {
      // Should not touch `enabled` setting or exclude.
      check('attributes.enabled', true, true)
      check('attributes.enabled', false, false)
      check('attributes.exclude', ['fizbang'], ['fizbang', 'request.parameters.*'])
      check('attributes.include', ['foobar'], [])
    })

    await t.test('should change transaction_tracer settings', () => {
      check('transaction_tracer.record_sql', 'raw', 'obfuscated')

      // Should not touch `enabled` setting.
      check('transaction_tracer.attributes.enabled', true, true)
      check('transaction_tracer.attributes.enabled', false, false)

      check('transaction_tracer.attributes.include', ['foobar'], [])
      check('transaction_tracer.attributes.exclude', ['fizbang'], ['fizbang'])
    })

    await t.test('should change error_collector settings', () => {
      // Should not touch `enabled` setting.
      check('error_collector.attributes.enabled', true, true)
      check('error_collector.attributes.enabled', false, false)

      check('error_collector.attributes.include', ['foobar'], [])
      check('error_collector.attributes.exclude', ['fizbang'], ['fizbang'])
    })

    await t.test('should change browser_monitoring settings', () => {
      // Should not touch `enabled` setting.
      check('browser_monitoring.attributes.enabled', true, true)
      check('browser_monitoring.attributes.enabled', false, false)

      check('browser_monitoring.attributes.include', ['foobar'], [])
      check('browser_monitoring.attributes.exclude', ['fizbang'], ['fizbang'])
    })

    await t.test('should change transaction_events settings', () => {
      // Should not touch `enabled` setting.
      check('transaction_events.attributes.enabled', true, true)
      check('transaction_events.attributes.enabled', false, false)

      check('transaction_events.attributes.include', ['foobar'], [])
      check('transaction_events.attributes.exclude', ['fizbang'], ['fizbang'])
    })

    await t.test('should detect that slow_sql is enabled', () => {
      check('slow_sql.enabled', true, false)
    })

    await t.test('should detect no problems', () => {
      const config = new Config({ high_security: true })
      config.ssl = true
      config.attributes.include = ['some val']
      config._applyHighSecurity()
      assert.equal(config.ssl, true)
      assert.equal(match(config.attributes.include, []), true)
    })
  })
})

test('affect custom params', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
    ctx.nr.api = new API(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should disable addCustomAttribute if high_security is on', (t) => {
    const { agent, api } = t.nr
    agent.config.high_security = true
    const success = api.addCustomAttribute('key', 'value')
    assert.equal(success, false)
  })

  await t.test('should not affect addCustomAttribute if high_security is off', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, () => {
      agent.config.high_security = false
      const success = api.addCustomAttribute('key', 'value')
      assert.equal(success, undefined)
      end()
    })
  })
})
