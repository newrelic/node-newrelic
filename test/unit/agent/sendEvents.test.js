'use strict'

var chai = require('chai')
var expect = chai.expect
var nock = require('nock')
var Reservoir = require('../../../lib/reservoir.js')
var helper = require('../../lib/agent_helper.js')
var CUSTOM_EVENTS = require('../../../lib/metrics/names.js').CUSTOM_EVENTS

/*
 *
 * CONSTANTS
 *
 */
var RUN_ID = 1337


describe('the New Relic agent', function () {
  before(function () {
    nock.disableNetConnect()
    console.log('called')
  })

  after(function () {
    nock.enableNetConnect()
  })

  describe('_sendEvents', function () {
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

    it('should pass events to server', function (done) {
      var r = new Reservoir()
      var e = {id: 1}
      r.add(e)
      agent.events = r
      agent._sendEvents(function cb__sendEvents() {
        expect(events[1][0]).equals(e)
        done()
      })
    })

    it('should send agent run id', function (done) {
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

  describe('_processCustomEvents', function () {
    var agent

    beforeEach(function () {
      agent = helper.loadMockedAgent()
    })

    afterEach(function () {
      helper.unloadAgent(agent)
    })

    it('should create supportability metrics', function () {
      var r = new Reservoir()
      r.limit = 1
      r.add({id: 1})
      r.add({id: 2})
      agent.customEvents = r
      agent._processCustomEvents()
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.DROPPED).callCount).equal(1)
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.SEEN).callCount).equal(2)
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.SENT).callCount).equal(1)
    })

    it('should create supportability metrics even when empty', function () {
      var r = new Reservoir()
      agent.customEvents = r
      agent._processCustomEvents()
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.DROPPED).callCount).equal(0)
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.SEEN).callCount).equal(0)
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.SENT).callCount).equal(0)
    })

    it('should create a customEventsPool on agent', function () {
      var r = new Reservoir()
      agent.customEvents = r
      expect(agent).not.property('customEventsPool')
      agent._processCustomEvents()
      expect(agent).property('customEventsPool')
    })
  })

  describe('_sendCustomEvents', function () {
    var agent, events, error

    beforeEach(function () {
      agent = helper.loadMockedAgent()

      agent.collector = {
        analyticsEvents: function (_events, callback) {
          events = _events
          process.nextTick(function () {
            callback(error)
          })
        }
      }
    })

    afterEach(function () {
      helper.unloadAgent(agent)
      events = undefined
      error = undefined
    })

    it('should push events to the server', function (done) {
      var r = new Reservoir()
      var e = {some: 'thing'}
      r.add(e)
      agent.customEventsPool = r.toArray()
      agent._sendCustomEvents(function cb__sendCustomEvents() {
        expect(events).length(2)
        expect(events[1][0]).equal(e)
        done()
      })
    })

    it('should not try to send if there are no events', function (done) {
      agent.collector = {
        analyticsEvents: function (_events, callback) {
          throw new Error('What is this, how did you get here?')
          process.nextTick(callback)
        }
      }
      var r = new Reservoir()
      agent.customEventsPool = r.toArray()
      agent._sendCustomEvents(function cb__sendCustomEvents() {
        done()
      })
    })

    it('should resample events if push failed with a 500', function (done) {
      error = {
        statusCode: 500
      }
      var previous = new Reservoir()
      var actual = new Reservoir()
      var e = {id: 1}
      previous.add(e)
      agent.customEventsPool = previous.toArray()
      agent.customEvents = actual

      agent._sendCustomEvents(function cb__sendCustomEvents(err) {
        expect(err).equal(error)
        var myEvents = actual.toArray()
        expect(myEvents).length(1)
        expect(myEvents[0]).equal(e)
        done()
      })
    })

    it('should not resample events if push failed with a 413', function (done) {
      error = {
        statusCode: 413
      }
      var previous = new Reservoir()
      var actual = new Reservoir()
      var e = {id: 1}
      previous.add(e)
      agent.customEventsPool = previous.toArray()
      agent.customEvents = actual

      agent._sendCustomEvents(function cb__sendCustomEvents(err) {
        expect(err).equal(error)
        var myEvents = actual.toArray()
        expect(myEvents).length(0)
        done()
      })
    })
  })
})
