/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var chai   = require('chai')
var helper = require('../lib/agent_helper')
var facts = require('../../lib/collector/facts')
var API = require('../../api')
var Config = require('../../lib/config')

var should = chai.should()
var expect = chai.expect


// simplified version of lodash set()
function setPath(obj, path, value) {
  let paths = path.split('.')
  while (paths.length - 1) {
    let key = paths.shift()
    if (!(key in obj)) { obj[key] = {} }
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

describe('high security mode', function() {
  describe('config to be sent during connect', function() {
    var agent = null

    beforeEach(function() {
      agent = helper.loadMockedAgent()
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it('should contain high_security', function() {
      facts(agent, function getFacts(factoids) {
        expect(factoids).to.have.property('high_security')
      })
    })
  })

  describe('conditional application of server side settings', function() {
    var config = null

    describe('when high_security === true', function() {
      beforeEach(function() {
        config = new Config({high_security: true})
      })

      it('should reject disabling ssl', function() {
        check('ssl', true, false)
      })

      it('should reject enabling allow_all_headers', function() {
        check('allow_all_headers', false, true)
      })

      it('should reject enabling slow_sql', function() {
        check('slow_sql.enabled', false, true)
      })

      it('should not change attributes settings', function() {
        check('attributes.include', [], ['foobar'])
        check('attributes.exclude', [], ['fizzbang', 'request.parameters.*'])
      })

      it('should not change transaction_tracer settings', function() {
        check('transaction_tracer.record_sql', 'obfuscated', 'raw')
        check('transaction_tracer.attributes.include', [], ['foobar'])
        check('transaction_tracer.attributes.exclude', [], ['fizzbang'])
      })

      it('should not change error_collector settings', function() {
        check('error_collector.attributes.include', [], ['foobar'])
        check('error_collector.attributes.exclude', [], ['fizzbang'])
      })

      it('should not change browser_monitoring settings', function() {
        check('browser_monitoring.attributes.include', [], ['foobar'])
        check('browser_monitoring.attributes.exclude', [], ['fizzbang'])
      })

      it('should not change transaction_events settings', function() {
        check('transaction_events.attributes.include', [], ['foobar'])
        check('transaction_events.attributes.exclude', [], ['fizzbang'])
      })

      it('should shut down the agent if high_security is false', function() {
        config.onConnect({high_security: false})
        expect(config.agent_enabled).to.be.false
      })

      it('should shut down the agent if high_security is missing', function() {
        config.onConnect({})
        expect(config.agent_enabled).to.be.false
      })

      function check(key, expected, server) {
        setPath(config, key, expected)
        var fromServer = {high_security: true}
        fromServer[key] = server

        expect(getPath(config, key)).to.deep.equal(expected)
        expect(fromServer).property(key).to.deep.equal(server)

        config.onConnect(fromServer)
        expect(getPath(config, key)).to.deep.equal(expected)
      }
    })

    describe('when high_security === false', function() {
      beforeEach(function() {
        config = new Config({high_security: false})
      })

      it('should accept disabling ssl', function() {
        // enabled by defualt, but lets make sure.
        config.ssl = true
        config.onConnect({ssl: false})
        config.ssl.should.equal(true)
      })
    })
  })

  describe('coerces other settings', function() {
    describe('_applyHighSecurity during init', function() {
      var orig = Config.prototype._applyHighSecurity
      var called

      beforeEach(function() {
        called = false
        Config.prototype._applyHighSecurity = function() {
          called = true
        }
      })

      afterEach(function() {
        Config.prototype._applyHighSecurity = orig
      })

      it('should call if high_security is on', function() {
        new Config({high_security: true}) // eslint-disable-line no-new
        called.should.equal(true)
      })

      it('should not call if high_security is off', function() {
        new Config({high_security: false}) // eslint-disable-line no-new
        called.should.equal(false)
      })
    })

    describe('when high_security === true', function() {
      it('should detect that ssl is off', function() {
        check('ssl', false, true)
      })

      it('should detect that allow_all_headers is on', function() {
        check('allow_all_headers', true, false)
      })

      it('should change attributes settings', function() {
        // Should not touch `enabled` setting or exclude.
        check('attributes.enabled', true, true)
        check('attributes.enabled', false, false)
        check('attributes.exclude', ['fizbang'], ['fizbang', 'request.parameters.*'])

        check('attributes.include', ['foobar'], [])
      })

      it('should change transaction_tracer settings', function() {
        check('transaction_tracer.record_sql', 'raw', 'obfuscated')

        // Should not touch `enabled` setting.
        check('transaction_tracer.attributes.enabled', true, true)
        check('transaction_tracer.attributes.enabled', false, false)

        check('transaction_tracer.attributes.include', ['foobar'], [])
        check('transaction_tracer.attributes.exclude', ['fizbang'], ['fizbang'])
      })

      it('should change error_collector settings', function() {
        // Should not touch `enabled` setting.
        check('error_collector.attributes.enabled', true, true)
        check('error_collector.attributes.enabled', false, false)

        check('error_collector.attributes.include', ['foobar'], [])
        check('error_collector.attributes.exclude', ['fizbang'], ['fizbang'])
      })

      it('should change browser_monitoring settings', function() {
        // Should not touch `enabled` setting.
        check('browser_monitoring.attributes.enabled', true, true)
        check('browser_monitoring.attributes.enabled', false, false)

        check('browser_monitoring.attributes.include', ['foobar'], [])
        check('browser_monitoring.attributes.exclude', ['fizbang'], ['fizbang'])
      })

      it('should change transaction_events settings', function() {
        // Should not touch `enabled` setting.
        check('transaction_events.attributes.enabled', true, true)
        check('transaction_events.attributes.enabled', false, false)

        check('transaction_events.attributes.include', ['foobar'], [])
        check('transaction_events.attributes.exclude', ['fizbang'], ['fizbang'])
      })

      it('should detect that slow_sql is enabled', function() {
        check('slow_sql.enabled', true, false)
      })

      it('should detect no problems', function() {
        var config = new Config({high_security: true})
        config.ssl = true
        config.attributes.include = ['some val']
        config._applyHighSecurity()
        config.ssl.should.equal(true)
        config.attributes.include.should.deep.equal([])
      })
    })

    function check(key, before, after) {
      var fromFile = {high_security: true}
      setPath(fromFile, key, before)

      var config = new Config(fromFile)
      expect(getPath(config, key)).to.deep.equal(after)
    }
  })

  describe('affect custom params', function() {
    var agent = null
    var api = null

    beforeEach(function() {
      agent = helper.loadMockedAgent()
      api = new API(agent)
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it('should disable addCustomAttribute if high_security is on', function() {
      agent.config.high_security = true
      var success = api.addCustomAttribute('key', 'value')
      success.should.equal(false)
    })

    it('should not affect addCustomAttribute if high_security is off', function() {
      helper.runInTransaction(agent, () => {
        agent.config.high_security = false
        const success = api.addCustomAttribute('key', 'value')
        should.not.exist(success)
      })
    })
  })
})
