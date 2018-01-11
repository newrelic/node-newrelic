'use strict'

var helper = require('../lib/agent_helper')
var chai = require('chai')
var expect = chai.expect
var Transaction = require('../../lib/transaction')


describe('Analytics events', function() {
  var agent = null
  var trans = null

  beforeEach(function() {
    agent = helper.loadMockedAgent()
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  describe('when there are attributes on transaction', function() {
    beforeEach(function() {
      trans = new Transaction(agent)
    })

    it('event should contain those attributes', function() {
      trans.trace.addAttribute('test', 'TEST')
      agent._addEventFromTransaction(trans)

      var first = 0
      var agentAttrs = 2
      expect(agent.events.toArray()[first][agentAttrs].test).equals('TEST')
    })
  })

  describe('when host name is specified by user', function() {
    beforeEach(function() {
      agent.config.process_host.display_name = 'test-value'
      trans = new Transaction(agent)
    })

    it('name should be sent with event', function() {
      agent._addEventFromTransaction(trans)

      var first = 0
      var agentAttrs = 2
      expect(agent.events.toArray()[first][agentAttrs]).deep.equals({
        'host.displayName': 'test-value'
      })
    })
  })

  describe('when analytics events are disabled', function() {
    it('should not send events to server', function(done) {
      agent.collector.analyticsEvents = function() {
        throw new Error() // FAIL
      }
      agent.config.transaction_events.enabled = false
      agent._sendEvents(function cb__sendEvents() {
        done()
      })
    })

    it('collector cannot enable remotely', function() {
      agent.config.transaction_events.enabled = false
      expect(function() {
        agent.config.onConnect({'collect_analytics_events' : true})
      }).not.throws()
      expect(agent.config.transaction_events.enabled).equals(false)
    })
  })

  describe('when analytics events are enabled', function() {
    it('collector can disable remotely', function() {
      agent.config.transaction_events.enabled = true
      expect(function() {
        agent.config.onConnect({'collect_analytics_events' : false})
      }).not.throws()
      expect(agent.config.transaction_events.enabled).equals(false)
    })
  })

  describe('on transaction finished', function() {
    beforeEach(function() {
      trans = new Transaction(agent)
    })

    it('should queue an event', function(done) {
      agent._addEventFromTransaction = function(transaction) {
        expect(transaction).to.equal(trans)
        done()
      }

      trans.end()
    })

    it('should generate an event from transaction', function(done) {
      trans.end(function() {
        expect(agent.events.toArray().length).to.equal(1)

        var event = agent.events.toArray()[0]
        expect(event).to.be.a('Array')
        expect(event[0]).to.be.a('object')
        expect(event[0].webDuration).to.be.a('number').and.not.NaN
        expect(event[0].webDuration).to.equal(trans.timer.getDurationInMillis() / 1000)
        expect(event[0].timestamp).to.be.a('number').and.not.NaN
        expect(event[0].timestamp).to.equal(trans.timer.start)
        expect(event[0].name).to.equal(trans.name)
        expect(event[0].duration).to.equal(trans.timer.getDurationInMillis() / 1000)
        expect(event[0].type).to.equal('Transaction')
        expect(event[0].error).to.equal(false)

        done()
      })
    })

    it('should contain user and agent attributes', function(done ) {
      trans.end(function() {
        expect(agent.events.toArray().length).to.equal(1)

        var event = agent.events.toArray()[0]
        expect(event[0]).to.be.an('Object')
        expect(event[1]).to.be.an('Object')
        expect(event[2]).to.be.an('Object')

        done()
      })
    })

    it('should contain custom parameters', function(done) {
      trans.trace.addCustomAttribute('a', 'b')
      trans.end(function() {
        var event = agent.events.toArray()[0]
        expect(event[1].a).to.equal('b')
        done()
      })
    })

    it('includes internal synthetics attributes', function(done) {
      trans.syntheticsData = {
        version: 1,
        accountId: 123,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      trans.end(function() {
        var event = agent.events.toArray()[0]
        var attributes = event[0]
        expect(attributes['nr.syntheticsResourceId']).equal('resId')
        expect(attributes['nr.syntheticsJobId']).equal('jobId')
        expect(attributes['nr.syntheticsMonitorId']).equal('monId')
        done()
      })
    })

    it('not spill over reservoir size', function() {
      agent.events.limit = 10

      for (var i = 0; i < 20; i++) {
        agent._addEventFromTransaction(trans)
      }

      expect(agent.events.toArray().length).equals(10)
    })

    it('re-aggregate on failure', function(done) {
      agent.collector.analyticsEvents = function(payload, cb) {
        cb(true)
      }
      trans = new Transaction(agent)

      for (var i = 0; i < 20; i++) {
        agent._addEventFromTransaction(trans)
      }

      agent._sendEvents(function(err) {
        expect(err).exist()
        expect(agent.events.toArray().length).equals(20)
        done()
      })
    })

    it('empty on success', function(done) {
      agent.collector.analyticsEvents = function(payload, cb) {
        cb()
      }
      trans = new Transaction(agent)

      for (var i = 0; i < 20; i++) {
        agent._addEventFromTransaction(trans)
      }

      agent._sendEvents(function(err) {
        expect(err).not.exist()
        expect(agent.events.toArray().length).equals(0)
        done()
      })
    })

    it('empty on 413', function(done) {
      agent.collector.analyticsEvents = function(payload, cb) {
        cb({statusCode: 413})
      }
      trans = new Transaction(agent)

      for (var i = 0; i < 20; i++) {
        agent._addEventFromTransaction(trans)
      }

      agent._sendEvents(function(err) {
        expect(err).exist()
        expect(agent.events.toArray().length).equals(0)
        done()
      })
    })
  })
})
