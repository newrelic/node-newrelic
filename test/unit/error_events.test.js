'use strict'

const helper = require('../lib/agent_helper')
const chai = require('chai')

const expect  = chai.expect


describe('Error events', function() {
  describe('when error events are disabled', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it('collector can override', function() {
      agent.config.error_collector.capture_events = false
      expect(function() {
        agent.config.onConnect({ 'error_collector.capture_events': true })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(true)
    })
  })

  describe('attributes', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })
    it('should include DT intrinsics', function(done) {
      agent.config.distributed_tracing.enabled = true
      agent.config.primary_application_id = 'test'
      agent.config.account_id = 1
      helper.runInTransaction(agent, function(tx) {
        const payload = tx.createDistributedTracePayload().text()
        tx.isDistributedTrace = null
        tx.acceptDistributedTracePayload(payload)
        var error = new Error('some error')
        tx.addException(error, {}, 0)
        tx.end()
        const attributes = agent.errors.eventAggregator.getEvents()[0][0]
        expect(attributes.type).to.equal('TransactionError')
        expect(attributes.traceId).to.equal(tx.id)
        expect(attributes.guid).to.equal(tx.id)
        expect(attributes.priority).to.equal(tx.priority)
        expect(attributes.sampled).to.equal(tx.sampled)
        expect(attributes['parent.type']).to.equal('App')
        expect(attributes['parent.app']).to.equal(agent.config.primary_application_id)
        expect(attributes['parent.account']).to.equal(agent.config.account_id)
        expect(attributes['nr.transactionGuid']).to.equal(tx.id)
        expect(attributes.parentId).to.be.undefined
        expect(attributes.parentSpanId).to.be.undefined
        done()
      })
    })

    it('should have the expected priority', function(done) {
      agent.config.distributed_tracing.enabled = true
      agent.config.primary_application_id = 'test'
      agent.config.account_id = 1
      helper.runInTransaction(agent, function(tx) {
        var error = new Error('some error')
        tx.addException(error, {}, 0)
        tx.end()
        const attributes = agent.errors.eventAggregator.getEvents()[0][0]
        expect(attributes.type).to.equal('TransactionError')
        expect(attributes.traceId).to.equal(tx.id)
        expect(attributes.guid).to.equal(tx.id)
        expect(attributes.priority).to.equal(tx.priority)
        expect(attributes.sampled).to.equal(tx.sampled)
        expect(attributes['nr.transactionGuid']).to.equal(tx.id)
        expect(tx.sampled).to.equal(true)
        expect(tx.priority).to.be.greaterThan(1)
        done()
      })
    })
  })

  describe('when error events are enabled', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
      agent.config.error_collector.capture_events = true
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it('collector can override', function() {
      expect(function() {
        agent.config.onConnect({ 'error_collector.capture_events': false })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(false)
    })

    it('collector can disable using the emergency shut off', function() {
      expect(function() {
        agent.config.onConnect({ collect_error_events: false })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(false)
    })

    it('collector cannot enable using the emergency shut off', function() {
      agent.config.error_collector.capture_events = false
      expect(function() {
        agent.config.onConnect({ collect_error_events: true })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(false)
    })
  })
})
