/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')

tap.test('SQL trace attributes', function (t) {
  t.autoend()
  t.beforeEach(function (t) {
    t.context.agent = helper.loadMockedAgent({
      slow_sql: {
        enabled: true
      },
      transaction_tracer: {
        record_sql: 'raw',
        explain_threshold: 0
      }
    })
  })

  t.afterEach(function (t) {
    helper.unloadAgent(t.context.agent)
  })

  t.test('should include all DT intrinsics sans parentId and parentSpanId', function (t) {
    const { agent } = t.context
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
        const sample = samples[0]
        const attributes = sample[sample.length - 1]
        t.equal(attributes.traceId, tx.traceId)
        t.equal(attributes.guid, tx.id)
        t.equal(attributes.priority, tx.priority)
        t.equal(attributes.sampled, tx.sampled)
        t.equal(attributes['parent.type'], 'App')
        t.equal(attributes['parent.app'], agent.config.primary_application_id)
        t.equal(attributes['parent.account'], agent.config.account_id)
        t.notOk(attributes.parentId)
        t.notOk(attributes.parentSpanId)
        t.end()
      })
    })
  })

  t.test('should serialize properly using prepareJSONSync', function (t) {
    const { agent } = t.context
    helper.runInTransaction(agent, function (tx) {
      const query = 'select pg_sleep(1)'
      agent.queries.add(tx.trace.root, 'postgres', query, 'FAKE STACK')
      const sampleObj = agent.queries.samples.values().next().value
      const sample = agent.queries.prepareJSONSync()[0]
      t.equal(sample[0], tx.getFullName())
      t.equal(sample[1], '<unknown>')
      t.equal(sample[2], sampleObj.trace.id)
      t.equal(sample[3], query)
      t.equal(sample[4], sampleObj.trace.metric)
      t.equal(sample[5], sampleObj.callCount)
      t.equal(sample[6], sampleObj.total)
      t.equal(sample[7], sampleObj.min)
      t.equal(sample[8], sampleObj.max)
      t.end()
    })
  })

  t.test('should include the proper priority on transaction end', function (t) {
    const { agent } = t.context
    agent.config.distributed_tracing.enabled = true
    agent.config.primary_application_id = 'test'
    agent.config.account_id = 1
    agent.config.simple_compression = true
    helper.runInTransaction(agent, function (tx) {
      agent.queries.add(tx.trace.root, 'postgres', 'select pg_sleep(1)', 'FAKE STACK')
      agent.queries.prepareJSON((err, samples) => {
        const sample = samples[0]
        const attributes = sample[sample.length - 1]
        t.equal(attributes.traceId, tx.traceId)
        t.equal(attributes.guid, tx.id)
        t.equal(attributes.priority, tx.priority)
        t.equal(attributes.sampled, tx.sampled)
        t.notOk(attributes.parentId)
        t.notOk(attributes.parentSpanId)
        t.equal(tx.sampled, true)
        t.ok(tx.priority > 1)
        t.end()
      })
    })
  })
})
