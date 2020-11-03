/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var chai   = require('chai')
var assert = require('assert')
var helper = require('../lib/agent_helper')
var API    = require('../../api')

var hashes = require('../../lib/util/hashes')


chai.should()

describe('the RUM API', function() {
  var agent
  var api


  beforeEach(function() {
    agent = helper.loadMockedAgent({
      license_key: 'license key here',
      browser_monitoring: {
        attributes: {
          enabled: true,
          include: ['*']
        }
      }
    })
    agent.config.browser_monitoring.enable          = true
    agent.config.browser_monitoring.debug           = false
    agent.config.application_id                     = 12345
    agent.config.browser_monitoring.browser_key     = 1234
    agent.config.browser_monitoring.js_agent_loader = 'function() {}'
    api = new API(agent)
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  it('should not generate header when disabled', function() {
    agent.config.browser_monitoring.enable = false
    api.getBrowserTimingHeader()
      .should.equal('<!-- NREUM: (0) -->')
  })

  it('should issue a warning outside a transaction', function() {
    api.getBrowserTimingHeader()
      .should.equal('<!-- NREUM: (1) -->')
  })

  it('should issue a warning if the transaction was ignored', function() {
    helper.runInTransaction(agent, function(tx) {
      tx.ignore = true
      api.getBrowserTimingHeader()
        .should.equal('<!-- NREUM: (1) -->')
    })
  })

  it('should issue a warning if transaction has no name', function() {
    helper.runInTransaction(agent, function() {
      api.getBrowserTimingHeader()
        .should.equal('<!-- NREUM: (3) -->')
    })
  })

  it('should issue a warning without an application_id', function() {
    agent.config.application_id = undefined
    helper.runInTransaction(agent, function(t) {
      t.finalizeNameFromUri('hello')
      api.getBrowserTimingHeader()
        .should.equal('<!-- NREUM: (4) -->')
    })
  })

  it('should return the rum headers when in a named transaction', function() {
    helper.runInTransaction(agent, function(t) {
      t.finalizeNameFromUri('hello')
      api.getBrowserTimingHeader()
        .indexOf('<script').should.equal(0)
    })
  })

  it('should return pretty print when debugging', function() {
    agent.config.browser_monitoring.debug = true
    helper.runInTransaction(agent, function(t) {
      t.finalizeNameFromUri('hello')
      var l = api.getBrowserTimingHeader().split('\n').length

      // there should be about 5 new lines here, this is a really *rough*
      // estimate if it's being pretty printed
      assert(l > 5)
    })
  })

  it('should be compact when not debugging', function() {
    helper.runInTransaction(agent, function(t) {
      t.finalizeNameFromUri('hello')
      var l = api.getBrowserTimingHeader().split('\n').length
      assert.equal(l, 1)
    })
  })

  it('should return empty headers when missing browser_key', function() {
    agent.config.browser_monitoring.browser_key = undefined
    helper.runInTransaction(agent, function(t) {
      t.finalizeNameFromUri('hello')
      api.getBrowserTimingHeader().should.equal('<!-- NREUM: (5) -->')
    })
  })

  it('should return empty headers when missing js_agent_loader', function() {
    agent.config.browser_monitoring.js_agent_loader = ''
    helper.runInTransaction(agent, function(t) {
      t.finalizeNameFromUri('hello')
      api.getBrowserTimingHeader().should.equal('<!-- NREUM: (6) -->')
    })
  })

  it('should be empty headers when loader is none', function() {
    agent.config.browser_monitoring.loader = 'none'
    helper.runInTransaction(agent, function(t) {
      t.finalizeNameFromUri('hello')
      api.getBrowserTimingHeader().should.equal('<!-- NREUM: (7) -->')
    })
  })

  it('should add nonce attribute to script if passed in options', function() {
    var nonce = '12345'
    helper.runInTransaction(agent, function(t) {
      t.finalizeNameFromUri('hello')
      api.getBrowserTimingHeader({ nonce: nonce })
        .indexOf('nonce="' + nonce + '">').should.not.equal(-1)
    })
  })

  it('should add custom attributes', function() {
    helper.runInTransaction(agent, function(t) {
      api.addCustomAttribute('hello', 1)
      t.finalizeNameFromUri('hello')
      var payload = /"atts":"(.*)"/.exec(api.getBrowserTimingHeader())
      payload.should.not.be.null
      var deobf = hashes.deobfuscateNameUsingKey(
        payload[1],
        agent.config.license_key.substr(0,13)
      )
      JSON.parse(deobf).u.hello.should.equal(1)
    })
  })
})
