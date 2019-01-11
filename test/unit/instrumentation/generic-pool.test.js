'use strict'

const chai   = require('chai')
const expect = chai.expect
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim.js')


describe("agent instrumentation of generic-pool", function() {
  var agent
  var initialize
  var shim

  before(function() {
    agent = helper.loadMockedAgent()
    shim = new Shim(agent, 'generic-pool')
    initialize = require('../../../lib/instrumentation/generic-pool')
  })

  after(function() {
    helper.unloadAgent(agent)
  })

  describe("shouldn't cause bootstrapping to fail", function() {
    it("when passed no module", function() {
      expect(function() { initialize(agent, null, 'generic-pool', shim) }).not.throws()
    })

    it("when passed an empty module", function() {
      expect(function() { initialize(agent, {}, 'generic-pool', shim) }).not.throws()
    })
  })

  describe("when wrapping callbacks passed into pool.acquire", function() {
    var mockPool = {
      Pool: function(arity) {
        return {
          acquire: function(callback) {
            expect(callback.length).equal(arity)
            expect(function() { callback() }).not.throws()
          }
        }
      }
    }

    before(function() {
      initialize(agent, mockPool, 'generic-pool', shim)
    })

    it("must preserve 'callback.length === 0' to keep generic-pool happy", (done) => {
      var nop = function() { return done() }
      expect(nop.length).equal(0)

      /* eslint-disable new-cap */
      mockPool.Pool(0).acquire(nop)
      /* eslint-enable new-cap */
    })

    it("must preserve 'callback.length === 1' to keep generic-pool happy", (done) => {
      var nop = function(client) { return done() || client }
      expect(nop.length).equal(1)

      /* eslint-disable new-cap */
      mockPool.Pool(1).acquire(nop)
      /* eslint-enable new-cap */
    })

    it("must preserve 'callback.length === 2' to keep generic-pool happy", (done) => {
      var nop = function(error, client) { return done() || error || client }
      expect(nop.length).equal(2)

      /* eslint-disable new-cap */
      mockPool.Pool(2).acquire(nop)
      /* eslint-enable new-cap */
    })
  })
})
