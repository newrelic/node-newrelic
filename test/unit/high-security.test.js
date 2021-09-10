/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

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

tap.Test.prototype.addAssert('check', 3, function (key, before, after) {
  const fromFile = { high_security: true }
  setPath(fromFile, key, before)

  const config = new Config(fromFile)
  return this.same(getPath(config, key), after)
})

tap.Test.prototype.addAssert('checkServer', 4, function (config, key, expected, server) {
  setPath(config, key, expected)
  const fromServer = { high_security: true }
  fromServer[key] = server

  this.same(getPath(config, key), expected)
  this.same(fromServer[key], server)

  config.onConnect(fromServer)
  return this.same(getPath(config, key), expected)
})

tap.test('high security mode', function (t) {
  t.autoend()

  t.test('config to be sent during connect', function (t) {
    t.autoend()
    let agent = null

    t.beforeEach(function () {
      agent = helper.loadMockedAgent()
    })

    t.afterEach(function () {
      helper.unloadAgent(agent)
    })

    t.test('should contain high_security', async function (t) {
      const factoids = await new Promise((resolve) => {
        facts(agent, resolve)
      })
      t.ok(Object.keys(factoids).includes('high_security'))
    })
  })

  t.test('conditional application of server side settings', function (t) {
    t.autoend()
    let config = null

    t.test('when high_security === true', function (t) {
      t.autoend()

      t.beforeEach(function () {
        config = new Config({ high_security: true })
      })

      t.test('should reject disabling ssl', function (t) {
        t.checkServer(config, 'ssl', true, false)
        t.end()
      })

      t.test('should reject enabling allow_all_headers', function (t) {
        t.checkServer(config, 'allow_all_headers', false, true)
        t.end()
      })

      t.test('should reject enabling slow_sql', function (t) {
        t.checkServer(config, 'slow_sql.enabled', false, true)
        t.end()
      })

      t.test('should not change attributes settings', function (t) {
        t.checkServer(config, 'attributes.include', [], ['foobar'])
        t.checkServer(config, 'attributes.exclude', [], ['fizzbang', 'request.parameters.*'])
        t.end()
      })

      t.test('should not change transaction_tracer settings', function (t) {
        t.checkServer(config, 'transaction_tracer.record_sql', 'obfuscated', 'raw')
        t.checkServer(config, 'transaction_tracer.attributes.include', [], ['foobar'])
        t.checkServer(config, 'transaction_tracer.attributes.exclude', [], ['fizzbang'])
        t.end()
      })

      t.test('should not change error_collector settings', function (t) {
        t.checkServer(config, 'error_collector.attributes.include', [], ['foobar'])
        t.checkServer(config, 'error_collector.attributes.exclude', [], ['fizzbang'])
        t.end()
      })

      t.test('should not change browser_monitoring settings', function (t) {
        t.checkServer(config, 'browser_monitoring.attributes.include', [], ['foobar'])
        t.checkServer(config, 'browser_monitoring.attributes.exclude', [], ['fizzbang'])
        t.end()
      })

      t.test('should not change transaction_events settings', function (t) {
        t.checkServer(config, 'transaction_events.attributes.include', [], ['foobar'])
        t.checkServer(config, 'transaction_events.attributes.exclude', [], ['fizzbang'])
        t.end()
      })

      t.test('should shut down the agent if high_security is false', function (t) {
        config.onConnect({ high_security: false })
        t.equal(config.agent_enabled, false)
        t.end()
      })

      t.test('should shut down the agent if high_security is missing', function (t) {
        config.onConnect({})
        t.equal(config.agent_enabled, false)
        t.end()
      })
    })

    t.test('when high_security === false', function (t) {
      t.autoend()

      t.beforeEach(function () {
        config = new Config({ high_security: false })
      })

      t.test('should accept disabling ssl', function (t) {
        // enabled by defualt, but lets make sure.
        config.ssl = true
        config.onConnect({ ssl: false })
        t.equal(config.ssl, true)
        t.end()
      })
    })
  })

  t.test('coerces other settings', function (t) {
    t.autoend()

    t.test('_applyHighSecurity during init', function (t) {
      t.autoend()

      const orig = Config.prototype._applyHighSecurity
      let called

      t.beforeEach(function () {
        called = false
        Config.prototype._applyHighSecurity = function () {
          called = true
        }
      })

      t.afterEach(function () {
        Config.prototype._applyHighSecurity = orig
      })

      t.test('should call if high_security is on', function (t) {
        new Config({ high_security: true }) // eslint-disable-line no-new
        t.equal(called, true)
        t.end()
      })

      t.test('should not call if high_security is off', function (t) {
        new Config({ high_security: false }) // eslint-disable-line no-new
        t.equal(called, false)
        t.end()
      })
    })

    t.test('when high_security === true', function (t) {
      t.autoend()

      t.test('should detect that ssl is off', function (t) {
        t.check('ssl', false, true)
        t.end()
      })

      t.test('should detect that allow_all_headers is on', function (t) {
        t.check('allow_all_headers', true, false)
        t.end()
      })

      t.test('should change attributes settings', function (t) {
        // Should not touch `enabled` setting or exclude.
        t.check('attributes.enabled', true, true)
        t.check('attributes.enabled', false, false)
        t.check('attributes.exclude', ['fizbang'], ['fizbang', 'request.parameters.*'])
        t.check('attributes.include', ['foobar'], [])
        t.end()
      })

      t.test('should change transaction_tracer settings', function (t) {
        t.check('transaction_tracer.record_sql', 'raw', 'obfuscated')

        // Should not touch `enabled` setting.
        t.check('transaction_tracer.attributes.enabled', true, true)
        t.check('transaction_tracer.attributes.enabled', false, false)

        t.check('transaction_tracer.attributes.include', ['foobar'], [])
        t.check('transaction_tracer.attributes.exclude', ['fizbang'], ['fizbang'])
        t.end()
      })

      t.test('should change error_collector settings', function (t) {
        // Should not touch `enabled` setting.
        t.check('error_collector.attributes.enabled', true, true)
        t.check('error_collector.attributes.enabled', false, false)

        t.check('error_collector.attributes.include', ['foobar'], [])
        t.check('error_collector.attributes.exclude', ['fizbang'], ['fizbang'])
        t.end()
      })

      t.test('should change browser_monitoring settings', function (t) {
        // Should not touch `enabled` setting.
        t.check('browser_monitoring.attributes.enabled', true, true)
        t.check('browser_monitoring.attributes.enabled', false, false)

        t.check('browser_monitoring.attributes.include', ['foobar'], [])
        t.check('browser_monitoring.attributes.exclude', ['fizbang'], ['fizbang'])
        t.end()
      })

      t.test('should change transaction_events settings', function (t) {
        // Should not touch `enabled` setting.
        t.check('transaction_events.attributes.enabled', true, true)
        t.check('transaction_events.attributes.enabled', false, false)

        t.check('transaction_events.attributes.include', ['foobar'], [])
        t.check('transaction_events.attributes.exclude', ['fizbang'], ['fizbang'])
        t.end()
      })

      t.test('should detect that slow_sql is enabled', function (t) {
        t.check('slow_sql.enabled', true, false)
        t.end()
      })

      t.test('should detect no problems', function (t) {
        const config = new Config({ high_security: true })
        config.ssl = true
        config.attributes.include = ['some val']
        config._applyHighSecurity()
        t.equal(config.ssl, true)
        t.same(config.attributes.include, [])
        t.end()
      })
    })
  })

  t.test('affect custom params', function (t) {
    t.autoend()
    let agent = null
    let api = null

    t.beforeEach(function () {
      agent = helper.loadMockedAgent()
      api = new API(agent)
    })

    t.afterEach(function () {
      helper.unloadAgent(agent)
    })

    t.test('should disable addCustomAttribute if high_security is on', function (t) {
      agent.config.high_security = true
      const success = api.addCustomAttribute('key', 'value')
      t.equal(success, false)
      t.end()
    })

    t.test('should not affect addCustomAttribute if high_security is off', function (t) {
      helper.runInTransaction(agent, () => {
        agent.config.high_security = false
        const success = api.addCustomAttribute('key', 'value')
        t.notOk(success)
        t.end()
      })
    })
  })
})
