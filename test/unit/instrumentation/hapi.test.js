/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var chai   = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')

var shims = require('../../../lib/shim')


describe("an instrumented Hapi application", function() {
  describe("shouldn't cause bootstrapping to fail", function() {
    var agent
    var initialize


    before(function() {
      agent = helper.loadMockedAgent()
      initialize = require('../../../lib/instrumentation/hapi')
    })

    after(function() {
      helper.unloadAgent(agent)
    })

    it("when passed nothing", function() {
      expect(function() { initialize() }).not.throws()
    })

    it("when passed no module", function() {
      expect(function() { initialize(agent) }).not.throws()
    })

    it("when passed an empty module", function() {
      initialize(agent, {})
      expect(function() { initialize(agent, {}) }).not.throws()
    })
  })

  describe("when stubbed", function() {
    var agent
    var stub


    beforeEach(function() {
      agent = helper.instrumentMockedAgent()
      agent.environment.clearFramework()

      function Server() {}
      Server.prototype.route = () => {}
      Server.prototype.start = () => {}

      stub = {Server : Server}

      var shim = new shims.WebFrameworkShim(agent, 'hapi')

      require('../../../lib/instrumentation/hapi')(agent, stub, 'hapi', shim)
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it("should set framework to Hapi when a new app is created", function() {
      var server = new stub.Server()
      server.start()

      var frameworks = agent.environment.get('Framework')
      expect(frameworks.length).equal(1)
      expect(frameworks[0]).equal('Hapi')
    })
  })
})
