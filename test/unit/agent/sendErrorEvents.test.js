'use strict'

var chai = require('chai')
var expect = chai.expect
var nock = require('nock')
var sinon = require('sinon')

var Reservoir = require('../../../lib/reservoir.js')
var helper = require('../../lib/agent_helper.js')
var Transaction = require('../../../lib/transaction')
var TRANSACTION_ERROR = require('../../../lib/metrics/names.js').TRANSACTION_ERROR


describe('the New Relic agent', function() {
  before(function () {
    nock.disableNetConnect()
  })

  after(function () {
    nock.enableNetConnect()
  })

  describe('_processErrorEvents', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it('should create supportability metrics', function() {
      agent.errors.add(null, new Error('some error'))
      agent._processErrorEvents()
      expect(agent.metrics.getMetric(TRANSACTION_ERROR.SEEN).callCount).equal(1)
      expect(agent.metrics.getMetric(TRANSACTION_ERROR.SENT).callCount).equal(1)
    })

    it('should create supportability metrics even when empty', function () {
      agent._processErrorEvents()
      expect(agent.metrics.getMetric(TRANSACTION_ERROR.SEEN).callCount).equal(0)
      expect(agent.metrics.getMetric(TRANSACTION_ERROR.SENT).callCount).equal(0)
    })
  })

  describe('_sendErrorEvents', function () {
    var agent, events

    beforeEach(function () {
      agent = helper.loadMockedAgent()

      agent.collector = {
        isConnected: function() { return true },
        metricData: function(payload, callback) {
          process.nextTick(callback)
        },
        errorEvents: function (_events, callback) {
          events = _events
          process.nextTick(callback)
        }
      }
    })

    afterEach(function () {
      helper.unloadAgent(agent)
      events = null
    })

    it('should send agent run id', function() {
      var error = new Error('some error')
      agent.errors.add(null, error)
      agent.config.run_id = 1234

      agent._sendErrorEvents(function cb__sendErrorEvents() {
        expect(events[0]).equals(1234)
        done()
      })
    })

    it('should send metrics', function() {
      var error = new Error('some error')
      agent.errors.add(null, error)

      expect(agent.errors.events).to.be.an.instanceof(Reservoir)

      agent._sendErrorEvents(function cb__sendErrorEvents() {
        var metrics = events[1]
        expect(metrics).to.be.an('object')
        expect(metrics).to.have.property('reservoir_size')
        expect(metrics).to.have.property('events_seen')
        done()
      })
    })

    it('sends correct reservoir metrics', function(done) {
      var error = new Error('some error')
      agent.errors.add(null, error)

      agent._sendMetrics(function cb_sendMetrics() {
        agent._sendErrorEvents(function cb__sendErrorEvents() {
          var metrics = events[1]
          expect(metrics.reservoir_size).equal(100)
          expect(metrics.events_seen).equal(1)
          done()
        })
      })
    })

    it('should send events', function (done) {
      var error = new Error('some error')
      agent.errors.add(null, error)
      var e = agent.errors.getEvents()[0]

      agent.collector = {
        isConnected: function() { return true },
        metricData: function(payload, callback) {
          process.nextTick(callback)
        },
        errorEvents: function (_events, callback) {
          events = _events
          process.nextTick(callback)
        }
      }

      // MK: this is not ideal that we need to make call to sendMetrics in order
      // to test sendErrorEvents(), but that's how custom events now work as as well
      agent._sendMetrics(function cb_sendMetrics() {
        agent._sendErrorEvents(function cb_sendErrorEvents() {
          expect(events[2][0]).equals(e)
          done()
        })
      })
    })

    it('should not try to send if there are no events', function (done) {
      agent.collector = {
        isConnected: function() { return true },
        metricData: function(payload, callback) {
          process.nextTick(callback)
        },
        errorEvents: function (_events, callback) {
          throw new Error('Should not have been called!')
          process.nextTick(callback)
        }
      }

      // sendMetrics() needs to be called before sendErrorEvents()
      agent._sendMetrics(function cb_sendMetrics() {
        agent._sendErrorEvents(function cb__sendErrorEvents() {
          done()
        })
      })
    })


    it('should not send events to the server when transaction is ignored',
        function(done) {
      sinon.spy(agent.collector, 'errorEvents')

      var transaction = new Transaction(agent)
      transaction.name = 'WebTransaction/test'
      transaction.statusCode = 200
      transaction.ignore = true

      agent.errors.add(transaction, new Error('some error'))

      transaction.end(function() {
        expect(agent.errors.getEvents().length).equal(0)
        agent._sendErrorEvents(function() {
          // verify that collector.errorEvents() was never called
          expect(agent.collector.errorEvents.called).to.be.false
          agent.collector.errorEvents.restore()
          done()
        })
      })
    })
  })
})