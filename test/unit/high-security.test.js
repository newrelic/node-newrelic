'use strict'

var path   = require('path')
  , chai   = require('chai')
  , helper = require('../lib/agent_helper.js')
  , facts  = require('../../lib/collector/facts.js')
  , API    = require('../../api.js')
  , Config = require('../../lib/config')
  

var should = chai.should()

describe('high security mode', function () {

  describe('config to be sent during connect', function () {
    var agent
      , api
      

    beforeEach(function () {
      agent = helper.loadMockedAgent()
      api = new API(agent)
    })

    afterEach(function () {
      helper.unloadAgent(agent)
    })

    it('should contain high_security', function () {
      var factoids = facts(agent)
      factoids.high_security.should.not.equal(null)
    })
  })

  describe('conditional application of server side settings', function () {
    var config

    describe('high_security === true', function () {
      beforeEach(function () {
        config = new Config({high_security: true})
      })

      it('should reject disabling ssl', function () {
        // enabled by defualt, but lets make sure.
        config.ssl = true
        config.onConnect({high_security: true, ssl: false})
        config.ssl.should.equal(true)
      })

      it('should reject enabling capture_params', function () {
        // disabled by default, but lets make sure.
        config.capture_params = false
        config.onConnect({high_security: true, capture_params: true})
        config.capture_params.should.equal(false)
      })

      it('should shut down the agent if high_security is false', function () {
        config.onConnect({high_security: false})
        config.agent_enabled.should.equal(false)
      })

      it('should shut down the agent if high_security is missing', function () {
        config.onConnect({})
        config.agent_enabled.should.equal(false)
      })
    })

    describe('high_security === false', function () {
      beforeEach(function () {
        config = new Config({high_security: false})
      })

      it('should accept disabling ssl', function () {
        // enabled by defualt, but lets make sure.
        config.ssl = true
        config.onConnect({ssl: false})
        config.ssl.should.equal(false)
      })

      it('should accept enabling capture_params', function () {
        // disabled by default, but lets make sure.
        config.capture_params = false
        config.onConnect({capture_params: true})
        config.capture_params.should.equal(true)
      })
    })
  })

  describe('coerces other settings', function () {
    describe('_applyHighSecurity during init', function () {
      var orig = Config.prototype._applyHighSecurity
      var called

      beforeEach(function () {
        called = false
        Config.prototype._applyHighSecurity = function() {
          called = true
        }
      })

      afterEach(function () {
        Config.prototype._applyHighSecurity = orig
      })

      it('should call if high_security is on', function () {
        // jshint nonew:false
        new Config({high_security: true})
        // jshint nonew:true
        called.should.equal(true)
      })

      it('should not call if high_security is off', function () {
        // jshint nonew:false
        new Config({high_security: false})
        // jshint nonew:true
        called.should.equal(false)
      })
    })


    describe('high_security === true', function () {
      it('should detect that ssl is off', function (done) {
        var config = new Config({high_security: true})
        config.ssl = false
        config.on('ssl', function(value) {
          value.should.equal(true)
          config.ssl.should.equal(true)
          done()
        })
        config._applyHighSecurity()
      })

      it('should detect that capture_params is on', function (done) {
        var config = new Config({'high_security': true})
        config.capture_params = true
        config.on('capture_params', function(value) {
          value.should.equal(false)
          config.capture_params.should.equal(false)
          done()
        })
        config._applyHighSecurity()
      })

      it('should detect no problems', function () {
        var config = new Config({high_security: true})
        config.ssl = true
        config.capture_params = false
        config._applyHighSecurity()
        config.ssl.should.equal(true)
        config.capture_params.should.equal(false)
      })
    })
  })

  describe('affect custom params', function () {
    var agent
      , api
      

    beforeEach(function () {
      agent = helper.loadMockedAgent()
      api = new API(agent)
    })

    afterEach(function () {
      helper.unloadAgent(agent)
    })

    it('should disable addCustomParameter if high_security is on', function () {
      agent.config.high_security = true
      var success = api.addCustomParameter('key', 'value')
      success.should.equal(false)
    })

    it('should not affect addCustomParameter if high_security is off', function () {
      agent.config.high_security = false
      var success = api.addCustomParameter('key', 'value')
      should.not.exist(success)
    })
  })
})
