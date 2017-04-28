'use strict'

var path   = require('path')
var chai   = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var Shim = require('../../../lib/shim/shim.js')
  

describe("agent instrumentation of generic-pool", function () {
  var agent
  var initialize
  var shim

  before(function () {
    agent = helper.loadMockedAgent()
    shim = new Shim(agent, 'generic-pool')
    initialize = require('../../../lib/instrumentation/generic-pool')
  })

  after(function () {
    helper.unloadAgent(agent)
  })

  describe("shouldn't cause bootstrapping to fail", function () {
    it("when passed no module", function () {
      expect(function () { initialize(agent, null, 'generic-pool', shim); }).not.throws()
    })

    it("when passed an empty module", function () {
      expect(function () { initialize(agent, {}, 'generic-pool', shim); }).not.throws()
    })
  })

  describe("when wrapping callbacks passed into pool.acquire", function () {
    var mockPool = {
          Pool : function (arity) {
            return {
              acquire : function (callback) {
                expect(callback.length).equal(arity)
                expect(function () { callback(); }).not.throws()
              }
            }
          }
        }
      

    before(function () {
      initialize(agent, mockPool, 'generic-pool', shim)
    })

    it("must preserve 'callback.length === 0' to keep generic-pool happy",
       function (done) {
      var nop = function () { return done(); }
      expect(nop.length).equal(0)

      mockPool.Pool(0).acquire(nop)
    })

    it("must preserve 'callback.length === 1' to keep generic-pool happy",
       function (done) {
      var nop = function (client) { return done() || client; }
      expect(nop.length).equal(1)

      mockPool.Pool(1).acquire(nop)
    })

    it("must preserve 'callback.length === 2' to keep generic-pool happy",
       function (done) {
      var nop = function (error, client) { return done() || error || client; }
      expect(nop.length).equal(2)

      mockPool.Pool(2).acquire(nop)
    })
  })
})
