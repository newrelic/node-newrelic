'use strict'

var chai = require('chai')
var expect = chai.expect
var nock = require('nock')
var PriorityQueue = require('../../../lib/priority-queue')
var helper = require('../../lib/agent_helper')
var CUSTOM_EVENTS = require('../../../lib/metrics/names').CUSTOM_EVENTS

var RUN_ID = 1337

describe('the New Relic agent', function() {
  before(function() {
    nock.disableNetConnect()
  })

  after(function() {
    nock.enableNetConnect()
  })

  describe('_sendEvents', function() {
    var agent, events, error

    beforeEach(function() {
      agent = helper.loadMockedAgent()

      agent.collector = {
        analyticsEvents: function(_events, callback) {
          events = _events
          process.nextTick(function() {
            callback(error)
          })
        }
      }
    })

    afterEach(function() {
      helper.unloadAgent(agent)
      events = undefined
      error = undefined
    })

    it('should report the reservoir size and number of events seen', function(done) {
      var q = new PriorityQueue()
      var e = {id: 1}
      q.add(e)
      agent.events = q
      agent._sendEvents(function() {
        expect(events[1].reservoir_size).equals(q.limit)
        expect(events[1].events_seen).equals(1)
        done()
      })
    })

    it('should pass events to server', function(done) {
      var q = new PriorityQueue()
      var e = {id: 1}
      q.add(e)
      agent.events = q
      agent._sendEvents(function() {
        expect(events[2][0]).equals(e)
        done()
      })
    })

    it('should send agent run id', function(done) {
      var q = new PriorityQueue()
      var e = {id: 1}
      q.add(e)
      agent.events = q
      agent.config.run_id = RUN_ID
      agent._sendEvents(function() {
        expect(events[0]).equals(RUN_ID)
        done()
      })
    })

    it('should not try to send if there are no events', function(done) {
      agent.collector = {
        analyticsEvents: function(_events, callback) {
          throw new Error('What is this, how did you get here?')
          process.nextTick(callback)
        }
      }
      var q = new PriorityQueue()
      agent.events = q
      agent._sendEvents(function() {
        done()
      })
    })

    it('should resample events if push failed with a 500', function(done) {
      error = {
        statusCode: 500
      }
      var q = new PriorityQueue()
      var e = {id: 1}
      q.add(e)
      agent.events = q

      agent._sendEvents(function(err) {
        expect(err).equal(error)
        var myEvents = agent.events.toArray()
        expect(myEvents).length(1)
        expect(myEvents[0]).equals(e)

        done()
      })
    })

    it('should not resample events if push failed with a 413', function(done) {
      error = {
        statusCode: 413
      }
      var q = new PriorityQueue()
      var e1 = {id: 1}
      var e2 = {id: 2}
      q.add(e1)
      q.add(e2)
      agent.events = q

      agent._sendEvents(function(err) {
        expect(err).equal(error)
        var myEvents = agent.events.toArray()
        expect(myEvents).length(0)
        done()
      })
    })
  })

  describe('_processCustomEvents', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it('should create supportability metrics', function() {
      var q = new PriorityQueue()
      q.limit = 1
      q.add({id: 1})
      q.add({id: 2})
      agent.customEvents = q
      agent._processCustomEvents()
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.DROPPED).callCount).equal(1)
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.SEEN).callCount).equal(2)
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.SENT).callCount).equal(1)
    })

    it('should create a new reservoir with the correct size', function() {
      agent.config.custom_insights_events.max_samples_stored = 1337
      // specifically create a queue with a different size
      var q = new PriorityQueue()
      q.limit = 100
      // add events to force _processCustomEvents to replace the queue
      q.add({id: 1})
      q.add({id: 2})
      agent.customEvents = q
      agent._processCustomEvents()
      expect(agent.customEvents).not.equal(q)
      expect(agent.customEvents.limit).equal(1337)
    })

    it('should create supportability metrics even when empty', function() {
      var q = new PriorityQueue()
      agent.customEvents = q
      agent._processCustomEvents()
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.DROPPED).callCount).equal(0)
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.SEEN).callCount).equal(0)
      expect(agent.metrics.getMetric(CUSTOM_EVENTS.SENT).callCount).equal(0)
    })

    it('should create a customEventsPool on agent', function() {
      var q = new PriorityQueue()
      agent.customEvents = q
      expect(agent).not.property('customEventsPool')
      agent._processCustomEvents()
      expect(agent).property('customEventsPool')
    })
  })

  describe('_sendCustomEvents', function() {
    var agent
    var events
    var error

    beforeEach(function() {
      agent = helper.loadMockedAgent()

      agent.collector = {
        customEvents: function(_events, callback) {
          events = _events
          process.nextTick(function() {
            callback(error)
          })
        }
      }
    })

    afterEach(function() {
      helper.unloadAgent(agent)
      events = undefined
      error = undefined
    })

    it('should push events to the server', function(done) {
      var q = new PriorityQueue()
      var e = {some: 'thing'}
      q.add(e)
      agent.customEventsPool = q._data
      agent._sendCustomEvents(function() {
        expect(events).length(2)
        expect(events[1][0]).equal(e)
        done()
      })
    })

    it('should not try to send if there are no events', function(done) {
      agent.collector = {
        customEvents: function(_events, callback) {
          throw new Error('What is this, how did you get here?')
          process.nextTick(callback)
        }
      }
      var q = new PriorityQueue()
      agent.customEventsPool = q._data
      agent._sendCustomEvents(function() {
        done()
      })
    })

    it('should resample events if push failed with a 500', function(done) {
      error = {
        statusCode: 500
      }
      var previous = new PriorityQueue()
      var actual = new PriorityQueue()
      var e = {id: 1}
      previous.add(e)
      agent.customEventsPool = previous._data
      agent.customEvents = actual

      agent._sendCustomEvents(function(err) {
        expect(err).equal(error)
        var myEvents = actual.toArray()
        expect(myEvents).length(1)
        expect(myEvents[0]).equal(e)
        done()
      })
    })

    it('should not resample events if push failed with a 413', function(done) {
      error = {
        statusCode: 413
      }
      var previous = new PriorityQueue()
      var actual = new PriorityQueue()
      var e = {id: 1}
      previous.add(e)
      agent.customEventsPool = previous._data
      agent.customEvents = actual

      agent._sendCustomEvents(function(err) {
        expect(err).equal(error)
        var myEvents = actual.toArray()
        expect(myEvents).length(0)
        done()
      })
    })
  })
})
