'use strict'

var path   = require('path')
  , chai   = require('chai')
  , assert = require('assert')
  , helper = require('../lib/agent_helper.js')
  , API    = require('../../api.js')
  

chai.should()

describe("the RUM API", function () {
  var agent
    , api
    

  beforeEach(function () {
    agent = helper.loadMockedAgent()
    agent.config.browser_monitoring.enable          = true
    agent.config.browser_monitoring.debug           = false
    agent.config.application_id                     = 12345
    agent.config.browser_monitoring.browser_key     = 1234
    agent.config.browser_monitoring.js_agent_loader = "function () {}"
    api = new API(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it('should not generate header when disabled', function () {
    agent.config.browser_monitoring.enable = false
    api.getBrowserTimingHeader()
      .should.equal('<!-- NREUM: (0) -->')
  })

  it('should issue a warning outside a transaction', function () {
    api.getBrowserTimingHeader()
      .should.equal('<!-- NREUM: (1) -->')
  })

  it('should issue a warning if transaction has no name', function () {
    helper.runInTransaction(agent, function () {
      api.getBrowserTimingHeader()
        .should.equal('<!-- NREUM: (3) -->')
    })
  })

  it('should issue a warning without an application_id', function () {
    agent.config.application_id = undefined
    helper.runInTransaction(agent, function (t) {
      t.setName('hello')
      api.getBrowserTimingHeader()
        .should.equal('<!-- NREUM: (4) -->')
    })
  })

  it('should return the rum headers when in a named transaction', function () {
    helper.runInTransaction(agent, function (t) {
      t.setName('hello')
      api.getBrowserTimingHeader()
        .indexOf('<script').should.equal(0)
    })
  })

  it('should return pretty print when debugging', function () {
    agent.config.browser_monitoring.debug = true
    helper.runInTransaction(agent, function (t) {
      t.setName('hello')
      var l = api.getBrowserTimingHeader().split('\n').length

      // there should be about 5 new lines here, this is a really *rough*
      // estimate if it's being pretty printed
      assert(l > 5)
    })
  })

  it('should be compact when not debugging', function () {
    helper.runInTransaction(agent, function (t) {
      t.setName('hello')
      var l = api.getBrowserTimingHeader().split('\n').length
      assert.equal(l, 1)
    })
  })

  it('should return empty headers when missing browser_key', function () {
    agent.config.browser_monitoring.browser_key = undefined
    helper.runInTransaction(agent, function (t) {
      t.setName('hello')
      api.getBrowserTimingHeader().should.equal('<!-- NREUM: (5) -->')
    })
  })

  it('should return empty headers when missing js_agent_loader', function () {
    agent.config.browser_monitoring.js_agent_loader = ""
    helper.runInTransaction(agent, function (t) {
      t.setName('hello')
      api.getBrowserTimingHeader().should.equal('<!-- NREUM: (6) -->')
    })
  })

  it('should be empty headers when loader is none', function () {
    agent.config.browser_monitoring.loader = "none"
    helper.runInTransaction(agent, function (t) {
      t.setName('hello')
      api.getBrowserTimingHeader().should.equal('<!-- NREUM: (7) -->')
    })
  })

})
