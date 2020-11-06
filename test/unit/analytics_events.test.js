/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var chai = require('chai')
var helper = require('../lib/agent_helper')
var Transaction = require('../../lib/transaction')

var DESTS = require('../../lib/config/attribute-filter').DESTINATIONS
var expect = chai.expect

const LIMIT = 10

describe('Analytics events', function() {
  var agent = null
  var trans = null

  beforeEach(function() {
    agent = helper.loadMockedAgent({
      transaction_events: {
        max_samples_stored: LIMIT
      }
    })
    agent.config.attributes.enabled = true
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  describe('when there are attributes on transaction', function() {
    beforeEach(function() {
      trans = new Transaction(agent)
    })

    it('event should contain those attributes', function() {
      trans.trace.attributes.addAttribute(DESTS.TRANS_EVENT, 'test', 'TEST')
      agent._addEventFromTransaction(trans)

      var first = 0
      var agentAttrs = 2

      const events = getTransactionEvents(agent)
      const firstEvent = events[first]
      expect(firstEvent[agentAttrs]).to.have.property('test', 'TEST')
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

      const events = getTransactionEvents(agent)
      const firstEvent = events[first]
      expect(firstEvent[agentAttrs]).deep.equals({
        'host.displayName': 'test-value'
      })
    })
  })

  describe('when analytics events are disabled', function() {
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

    it('should generate an event from transaction', function() {
      trans.end()

      const events = getTransactionEvents(agent)

      expect(events.length).to.equal(1)

      var event = events[0]
      expect(event).to.be.a('Array')
      var eventValues = event[0]
      expect(eventValues).to.be.a('object')
      expect(eventValues.webDuration).to.be.a('number').and.not.NaN
      expect(eventValues.webDuration).to.equal(trans.timer.getDurationInMillis() / 1000)
      expect(eventValues.timestamp).to.be.a('number').and.not.NaN
      expect(eventValues.timestamp).to.equal(trans.timer.start)
      expect(eventValues.name).to.equal(trans.name)
      expect(eventValues.duration).to.equal(trans.timer.getDurationInMillis() / 1000)
      expect(eventValues.type).to.equal('Transaction')
      expect(eventValues.error).to.equal(false)
    })

    it('should flag errored transactions', function() {
      trans.addException(new Error('wuh oh'))
      trans.end()

      const events = getTransactionEvents(agent)
      expect(events.length).to.equal(1)

      var event = events[0]
      expect(event).to.be.a('Array')
      var eventValues = event[0]
      expect(eventValues).to.be.a('object')
      expect(eventValues.webDuration).to.be.a('number').and.not.NaN
      expect(eventValues.webDuration).to.equal(trans.timer.getDurationInMillis() / 1000)
      expect(eventValues.timestamp).to.be.a('number').and.not.NaN
      expect(eventValues.timestamp).to.equal(trans.timer.start)
      expect(eventValues.name).to.equal(trans.name)
      expect(eventValues.duration).to.equal(trans.timer.getDurationInMillis() / 1000)
      expect(eventValues.type).to.equal('Transaction')
      expect(eventValues.error).to.equal(true)
    })

    it('should add DT parent attributes with an accepted payload', function() {
      agent.config.distributed_tracing.enabled = true
      agent.config.primary_application_id = 'test'
      agent.config.account_id = 1
      trans = new Transaction(agent)
      const payload = trans._createDistributedTracePayload().text()
      trans.isDistributedTrace = null
      trans._acceptDistributedTracePayload(payload)
      trans.end()

      const events = getTransactionEvents(agent)

      expect(events.length).to.equal(1)

      const attributes = events[0][0]
      expect(attributes.traceId).to.equal(trans.traceId)
      expect(attributes.guid).to.equal(trans.id)
      expect(attributes.priority).to.equal(trans.priority)
      expect(attributes.sampled).to.equal(trans.sampled)
      expect(attributes.parentId).to.equal(trans.id)
      expect(attributes['parent.type']).to.equal('App')
      expect(attributes['parent.app']).to.equal(agent.config.primary_application_id)
      expect(attributes['parent.account']).to.equal(agent.config.account_id)
      expect(attributes.error).to.equal(false)
      expect(trans.sampled).to.equal(true)
      expect(trans.priority).to.be.greaterThan(1)
    })

    it('should add DT attributes', function() {
      agent.config.distributed_tracing.enabled = true
      trans = new Transaction(agent)
      trans.end()

      const events = getTransactionEvents(agent)

      expect(events.length).to.equal(1)

      var attributes = events[0][0]
      expect(attributes.traceId).to.equal(trans.traceId)
      expect(attributes.guid).to.equal(trans.id)
      expect(attributes.priority).to.equal(trans.priority)
      expect(attributes.sampled).to.equal(trans.sampled)
      expect(trans.sampled).to.equal(true)
      expect(trans.priority).to.be.greaterThan(1)
    })


    it('should contain user and agent attributes', function() {
      trans.end()

      const events = getTransactionEvents(agent)

      expect(events.length).to.equal(1)

      var event = events[0]
      expect(event[0]).to.be.an('Object')
      expect(event[1]).to.be.an('Object')
      expect(event[2]).to.be.an('Object')
    })

    it('should contain custom attributes', function() {
      trans.trace.addCustomAttribute('a', 'b')
      trans.end()

      const events = getTransactionEvents(agent)
      var event = events[0]
      expect(event[1].a).to.equal('b')
    })

    it('includes internal synthetics attributes', function() {
      trans.syntheticsData = {
        version: 1,
        accountId: 123,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      trans.end()

      const events = getTransactionEvents(agent)
      var event = events[0]
      var attributes = event[0]
      expect(attributes['nr.syntheticsResourceId']).equal('resId')
      expect(attributes['nr.syntheticsJobId']).equal('jobId')
      expect(attributes['nr.syntheticsMonitorId']).equal('monId')
    })

    it('not spill over reservoir size', function() {
      for (var i = 0; i < 20; i++) {
        agent._addEventFromTransaction(trans)
      }

      expect(getTransactionEvents(agent).length).equals(LIMIT)
    })
  })
})

function getTransactionEvents(agent) {
  return agent.transactionEventAggregator.getEvents()
}
