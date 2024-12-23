/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')

test('SQL trace attributes', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      slow_sql: {
        enabled: true
      },
      transaction_tracer: {
        record_sql: 'raw',
        explain_threshold: 0
      }
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test(
    'should include all DT intrinsics sans parentId and parentSpanId',
    function (t, end) {
      const { agent } = t.nr
      agent.config.distributed_tracing.enabled = true
      agent.config.primary_application_id = 'test'
      agent.config.account_id = 1
      agent.config.simple_compression = true
      helper.runInTransaction(agent, function (tx) {
        const payload = tx._createDistributedTracePayload().text()
        tx.isDistributedTrace = null
        tx._acceptDistributedTracePayload(payload)
        agent.queries.add(tx.trace.root, 'postgres', 'select pg_sleep(1)', 'FAKE STACK')
        agent.queries.prepareJSON((err, samples) => {
          assert.ifError(err)
          const sample = samples[0]
          const attributes = sample[sample.length - 1]
          assert.equal(attributes.traceId, tx.traceId)
          assert.equal(attributes.guid, tx.id)
          assert.equal(attributes.priority, tx.priority)
          assert.equal(attributes.sampled, tx.sampled)
          assert.equal(attributes['parent.type'], 'App')
          assert.equal(attributes['parent.app'], agent.config.primary_application_id)
          assert.equal(attributes['parent.account'], agent.config.account_id)
          assert.ok(!attributes.parentId)
          assert.ok(!attributes.parentSpanId)
          end()
        })
      })
    }
  )

  await t.test('should serialize properly using prepareJSONSync', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function (tx) {
      const query = 'select pg_sleep(1)'
      agent.queries.add(tx.trace.root, 'postgres', query, 'FAKE STACK')
      const sampleObj = agent.queries.samples.values().next().value
      const sample = agent.queries.prepareJSONSync()[0]
      assert.equal(sample[0], tx.getFullName())
      assert.equal(sample[1], '<unknown>')
      assert.equal(sample[2], sampleObj.trace.id)
      assert.equal(sample[3], query)
      assert.equal(sample[4], sampleObj.trace.metric)
      assert.equal(sample[5], sampleObj.callCount)
      assert.equal(sample[6], sampleObj.total)
      assert.equal(sample[7], sampleObj.min)
      assert.equal(sample[8], sampleObj.max)
      end()
    })
  })

  await t.test('should include the proper priority on transaction end', function (t, end) {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.primary_application_id = 'test'
    agent.config.account_id = 1
    agent.config.simple_compression = true
    helper.runInTransaction(agent, function (tx) {
      agent.queries.add(tx.trace.root, 'postgres', 'select pg_sleep(1)', 'FAKE STACK')
      agent.queries.prepareJSON((err, samples) => {
        assert.ifError(err)
        const sample = samples[0]
        const attributes = sample[sample.length - 1]
        assert.equal(attributes.traceId, tx.traceId)
        assert.equal(attributes.guid, tx.id)
        assert.equal(attributes.priority, tx.priority)
        assert.equal(attributes.sampled, tx.sampled)
        assert.ok(!attributes.parentId)
        assert.ok(!attributes.parentSpanId)
        assert.equal(tx.sampled, true)
        assert.ok(tx.priority > 1)
        end()
      })
    })
  })
})
