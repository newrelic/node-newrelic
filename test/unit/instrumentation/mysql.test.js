'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')


describe("agent instrumentation of MySQL", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize


    before(function () {
      agent = helper.loadMockedAgent()
      initialize = require('../../../lib/instrumentation/mysql')
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws()
    })

    it("when passed an empty module", function () {
      expect(function () { initialize(agent, {}); }).not.throws()
    })
  })
})
