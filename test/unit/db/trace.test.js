'use strict'

const helper = require('../../lib/agent_helper')
const chai = require('chai')

const expect  = chai.expect

describe('SQL trace', function() {
  describe('attributes', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent(null, {
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
        agent.queries.addQuery(
          tx.trace.root,
          'postgres',
          'select pg_sleep(1)',
          'FAKE STACK'
        )
        agent.queries.prepareJSON((err, samples) => {
          const sample = samples[0]
          const attributes = sample[sample.length - 1]
          expect(attributes.traceId).to.equal(tx.id)
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
    it('should include the proper priority on transaction end', function(done) {
      agent.config.distributed_tracing.enabled = true
      agent.config.primary_application_id = 'test'
      agent.config.account_id = 1
      agent.config.simple_compression = true
      helper.runInTransaction(agent, function(tx) {
        agent.queries.addQuery(
          tx.trace.root,
          'postgres',
          'select pg_sleep(1)',
          'FAKE STACK'
        )
        agent.queries.prepareJSON((err, samples) => {
          const sample = samples[0]
          const attributes = sample[sample.length - 1]
          expect(attributes.traceId).to.equal(tx.id)
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
