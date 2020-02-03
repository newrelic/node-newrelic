'use strict'

const helper = require('../../lib/agent_helper')
const chai = require('chai')

const expect  = chai.expect

describe('SQL trace', function() {
  describe('attributes', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent({
        slow_sql: {
          enabled: true
        },
        transaction_tracer: {
          record_sql: 'raw',
          explain_threshold: 0
        }
      })
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it('should include all DT intrinsics sans parentId and parentSpanId', function(done) {
      agent.config.distributed_tracing.enabled = true
      agent.config.primary_application_id = 'test'
      agent.config.account_id = 1
      agent.config.simple_compression = true
      helper.runInTransaction(agent, function(tx) {
        const payload = tx.createDistributedTracePayload().text()
        tx.isDistributedTrace = null
        tx.acceptDistributedTracePayload(payload)
        agent.queries.add(
          tx.trace.root,
          'postgres',
          'select pg_sleep(1)',
          'FAKE STACK'
        )
        agent.queries.prepareJSON((err, samples) => {
          const sample = samples[0]
          const attributes = sample[sample.length - 1]
          expect(attributes.traceId).to.equal(tx.traceId)
          expect(attributes.guid).to.equal(tx.id)
          expect(attributes.priority).to.equal(tx.priority)
          expect(attributes.sampled).to.equal(tx.sampled)
          expect(attributes['parent.type']).to.equal('App')
          expect(attributes['parent.app']).to.equal(agent.config.primary_application_id)
          expect(attributes['parent.account']).to.equal(agent.config.account_id)
          expect(attributes.parentId).to.be.undefined
          expect(attributes.parentSpanId).to.be.undefined
          done()
        })
      })
    })

    it('should serialize properly using prepareJSONSync', function() {
      helper.runInTransaction(agent, function(tx) {
        const query = 'select pg_sleep(1)'
        agent.queries.add(
          tx.trace.root,
          'postgres',
          query,
          'FAKE STACK'
        )
        const sampleObj = agent.queries.samples.values().next().value
        const sample = agent.queries.prepareJSONSync()[0]
        expect(sample[0]).to.equal(tx.getFullName())
        expect(sample[1]).to.equal('<unknown>')
        expect(sample[2]).to.equal(sampleObj.trace.id)
        expect(sample[3]).to.equal(query)
        expect(sample[4]).to.equal(sampleObj.trace.metric)
        expect(sample[5]).to.equal(sampleObj.callCount)
        expect(sample[6]).to.equal(sampleObj.total)
        expect(sample[7]).to.equal(sampleObj.min)
        expect(sample[8]).to.equal(sampleObj.max)
      })
    })

    it('should include the proper priority on transaction end', function(done) {
      agent.config.distributed_tracing.enabled = true
      agent.config.primary_application_id = 'test'
      agent.config.account_id = 1
      agent.config.simple_compression = true
      helper.runInTransaction(agent, function(tx) {
        agent.queries.add(
          tx.trace.root,
          'postgres',
          'select pg_sleep(1)',
          'FAKE STACK'
        )
        agent.queries.prepareJSON((err, samples) => {
          const sample = samples[0]
          const attributes = sample[sample.length - 1]
          expect(attributes.traceId).to.equal(tx.traceId)
          expect(attributes.guid).to.equal(tx.id)
          expect(attributes.priority).to.equal(tx.priority)
          expect(attributes.sampled).to.equal(tx.sampled)
          expect(attributes.parentId).to.be.undefined
          expect(attributes.parentSpanId).to.be.undefined
          expect(tx.sampled).to.equal(true)
          expect(tx.priority).to.be.greaterThan(1)
          done()
        })
      })
    })
  })
})
