'use strict'

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , nock         = require('nock')
  , Reservoir    = require('../../lib/reservoir.js')
  , helper       = require('../lib/agent_helper.js')
  

/*
 *
 * CONSTANTS
 *
 */
var RUN_ID = 1337
  

describe("the New Relic agent", function () {
  before(function () {
    nock.disableNetConnect()
  })

  after(function () {
    nock.enableNetConnect()
  })

  describe("_sendEvents", function () {
    var agent, events

    beforeEach(function () {
      agent = helper.loadMockedAgent()

      agent.collector = {
        analyticsEvents: function (_events, callback) {
          events = _events
          process.nextTick(callback)
        }
      }
    })

    afterEach(function () {
      helper.unloadAgent(agent)
    })

    it("should pass events to server", function (done) {
      var r = new Reservoir()
      var e = {id: 1}
      r.add(e)
      agent.events = r
      agent._sendEvents(function cb__sendEvents() {
        expect(events[1][0]).equals(e)
        done()
      })
    })

    it("should send agent run id", function (done) {
      var r = new Reservoir()
      var e = {id: 1}
      r.add(e)
      agent.events = r
      agent.config.run_id = RUN_ID
      agent._sendEvents(function cb__sendEvents() {
        expect(events[0]).equals(RUN_ID)
        done()
      })
    })

  })
})
