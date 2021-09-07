/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

var helper = require('../lib/agent_helper')
var facts = require('../../lib/collector/facts')
var API = require('../../api')
var Config = require('../../lib/config')

// simplified version of lodash set()
function setPath(obj, path, value) {
  let paths = path.split('.')
  while (paths.length - 1) {
    let key = paths.shift()
    if (!(key in obj)) {
      obj[key] = {}
    }
    obj = obj[key]
  }
  obj[paths[0]] = value
}

// simplified version of lodash get()
function getPath(obj, path) {
  let paths = path.split('.')
  while (paths.length - 1) {
    let key = paths.shift()
    obj = obj[key]
  }
  return obj[paths[0]]
}

tap.test('high security mode', function (t) {
  t.autoend()

  t.test('config to be sent during connect', function (t) {
    t.autoend()
    var agent = null

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
    var config = null

    t.test('when high_security === true', function (t) {
      t.autoend()

      t.beforeEach(function () {
        config = new Config({ high_security: true })
      })

      t.test('should reject disabling ssl', function (t) {
        check(t, 'ssl', true, false)
        t.end()
      })

      t.test('should reject enabling allow_all_headers', function (t) {
        check(t, 'allow_all_headers', false, true)
        t.end()
      })

      t.test('should reject enabling slow_sql', function (t) {
        check(t, 'slow_sql.enabled', false, true)
        t.end()
      })

      t.test('should not change attributes settings', function (t) {
        check(t, 'attributes.include', [], ['foobar'])
        check(t, 'attributes.exclude', [], ['fizzbang', 'request.parameters.*'])
        t.end()
      })

      t.test('should not change transaction_tracer settings', function (t) {
        check(t, 'transaction_tracer.record_sql', 'obfuscated', 'raw')
        check(t, 'transaction_tracer.attributes.include', [], ['foobar'])
        check(t, 'transaction_tracer.attributes.exclude', [], ['fizzbang'])
        t.end()
      })

      t.test('should not change error_collector settings', function (t) {
        check(t, 'error_collector.attributes.include', [], ['foobar'])
        check(t, 'error_collector.attributes.exclude', [], ['fizzbang'])
        t.end()
      })

      t.test('should not change browser_monitoring settings', function (t) {
        check(t, 'browser_monitoring.attributes.include', [], ['foobar'])
        check(t, 'browser_monitoring.attributes.exclude', [], ['fizzbang'])
        t.end()
      })

      t.test('should not change transaction_events settings', function (t) {
        check(t, 'transaction_events.attributes.include', [], ['foobar'])
        check(t, 'transaction_events.attributes.exclude', [], ['fizzbang'])
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

      function check(t, key, expected, server) {
        setPath(config, key, expected)
        var fromServer = { high_security: true }
        fromServer[key] = server

        t.deepEqual(getPath(config, key), expected)
        t.deepEqual(fromServer[key], server)

        config.onConnect(fromServer)
        t.deepEqual(getPath(config, key), expected)
      }
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

      var orig = Config.prototype._applyHighSecurity
      var called

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
        check(t, 'ssl', false, true)
        t.end()
      })

      t.test('should detect that allow_all_headers is on', function (t) {
        check(t, 'allow_all_headers', true, false)
        t.end()
      })

      t.test('should change attributes settings', function (t) {
        // Should not touch `enabled` setting or exclude.
        check(t, 'attributes.enabled', true, true)
        check(t, 'attributes.enabled', false, false)
        check(t, 'attributes.exclude', ['fizbang'], ['fizbang', 'request.parameters.*'])

        check(t, 'attributes.include', ['foobar'], [])
        t.end()
      })

      t.test('should change transaction_tracer settings', function (t) {
        check(t, 'transaction_tracer.record_sql', 'raw', 'obfuscated')

        // Should not touch `enabled` setting.
        check(t, 'transaction_tracer.attributes.enabled', true, true)
        check(t, 'transaction_tracer.attributes.enabled', false, false)

        check(t, 'transaction_tracer.attributes.include', ['foobar'], [])
        check(t, 'transaction_tracer.attributes.exclude', ['fizbang'], ['fizbang'])
        t.end()
      })

      t.test('should change error_collector settings', function (t) {
        // Should not touch `enabled` setting.
        check(t, 'error_collector.attributes.enabled', true, true)
        check(t, 'error_collector.attributes.enabled', false, false)

        check(t, 'error_collector.attributes.include', ['foobar'], [])
        check(t, 'error_collector.attributes.exclude', ['fizbang'], ['fizbang'])
        t.end()
      })

      t.test('should change browser_monitoring settings', function (t) {
        // Should not touch `enabled` setting.
        check(t, 'browser_monitoring.attributes.enabled', true, true)
        check(t, 'browser_monitoring.attributes.enabled', false, false)

        check(t, 'browser_monitoring.attributes.include', ['foobar'], [])
        check(t, 'browser_monitoring.attributes.exclude', ['fizbang'], ['fizbang'])
        t.end()
      })

      t.test('should change transaction_events settings', function (t) {
        // Should not touch `enabled` setting.
        check(t, 'transaction_events.attributes.enabled', true, true)
        check(t, 'transaction_events.attributes.enabled', false, false)

        check(t, 'transaction_events.attributes.include', ['foobar'], [])
        check(t, 'transaction_events.attributes.exclude', ['fizbang'], ['fizbang'])
        t.end()
      })

      t.test('should detect that slow_sql is enabled', function (t) {
        check(t, 'slow_sql.enabled', true, false)
        t.end()
      })

      t.test('should detect no problems', function (t) {
        var config = new Config({ high_security: true })
        config.ssl = true
        config.attributes.include = ['some val']
        config._applyHighSecurity()
        t.equal(config.ssl, true)
        t.deepEqual(config.attributes.include, [])
        t.end()
      })
    })

    function check(t, key, before, after) {
      var fromFile = { high_security: true }
      setPath(fromFile, key, before)

      var config = new Config(fromFile)
      t.deepEqual(getPath(config, key), after)
    }
  })

  t.test('affect custom params', function (t) {
    t.autoend()
    var agent = null
    var api = null

    t.beforeEach(function () {
      agent = helper.loadMockedAgent()
      api = new API(agent)
    })

    t.afterEach(function () {
      helper.unloadAgent(agent)
    })

    t.test('should disable addCustomAttribute if high_security is on', function (t) {
      agent.config.high_security = true
      var success = api.addCustomAttribute('key', 'value')
      t.equal(success, false)
      t.end()
    })

    t.test('should not affect addCustomAttribute if high_security is off', function (t) {
      helper.runInTransaction(agent, () => {
        agent.config.high_security = false
        const success = api.addCustomAttribute('key', 'value')
        t.ok([null, undefined].includes(success))
        t.end()
      })
    })
  })
})
