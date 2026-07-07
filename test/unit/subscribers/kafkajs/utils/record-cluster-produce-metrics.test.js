/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const recordClusterProduceMetrics = require('#agentlib/subscribers/kafkajs/utils/record-cluster-produce-metrics.js')

function makeMetrics() {
  const store = new Map()
  return {
    store,
    getOrCreateMetric(name) {
      if (!store.has(name)) store.set(name, { callCount: 0, incrementCallCount(n = 1) { this.callCount += n } })
      return store.get(name)
    }
  }
}

const CLUSTER = 'cluster-uuid-1'

// ── send() path (batch === false) ────────────────────────────────────────────

test('send(): records one produce metric for the topic', () => {
  const metrics = makeMetrics()
  recordClusterProduceMetrics(metrics, CLUSTER, false, { topic: 'my-topic', messages: [{ value: 'a' }, { value: 'b' }] })
  assert.strictEqual(metrics.store.get(`MessageBroker/Kafka/Cluster/${CLUSTER}/Topic/my-topic/Produce`).callCount, 2)
})

test('send(): callCount equals the number of messages', () => {
  const metrics = makeMetrics()
  recordClusterProduceMetrics(metrics, CLUSTER, false, { topic: 'events', messages: [{ value: '1' }] })
  const metric = metrics.store.get(`MessageBroker/Kafka/Cluster/${CLUSTER}/Topic/events/Produce`)
  assert.strictEqual(metric.callCount, 1)
})

// ── sendBatch() path (batch === true) ────────────────────────────────────────

test('sendBatch(): records one metric per distinct topic', () => {
  const metrics = makeMetrics()
  recordClusterProduceMetrics(metrics, CLUSTER, true, {
    topicMessages: [
      { topic: 'topic-a', messages: [{ value: '1' }, { value: '2' }] },
      { topic: 'topic-b', messages: [{ value: '3' }] }
    ]
  })
  assert.strictEqual(metrics.store.get(`MessageBroker/Kafka/Cluster/${CLUSTER}/Topic/topic-a/Produce`).callCount, 2)
  assert.strictEqual(metrics.store.get(`MessageBroker/Kafka/Cluster/${CLUSTER}/Topic/topic-b/Produce`).callCount, 1)
})

test('sendBatch(): accumulates across repeated calls for the same topic', () => {
  const metrics = makeMetrics()
  recordClusterProduceMetrics(metrics, CLUSTER, true, {
    topicMessages: [{ topic: 'orders', messages: [{ value: 'x' }] }]
  })
  recordClusterProduceMetrics(metrics, CLUSTER, true, {
    topicMessages: [{ topic: 'orders', messages: [{ value: 'y' }, { value: 'z' }] }]
  })
  assert.strictEqual(metrics.store.get(`MessageBroker/Kafka/Cluster/${CLUSTER}/Topic/orders/Produce`).callCount, 3)
})

test('sendBatch(): handles empty topicMessages without throwing', () => {
  const metrics = makeMetrics()
  assert.doesNotThrow(() => recordClusterProduceMetrics(metrics, CLUSTER, true, { topicMessages: [] }))
  assert.strictEqual(metrics.store.size, 0)
})
