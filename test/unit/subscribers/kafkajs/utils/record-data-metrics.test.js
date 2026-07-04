/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const recordDataMetrics = require('#agentlib/subscribers/kafkajs/utils/record-data-metrics.js')

function makeMetrics() {
  const store = new Map()
  return {
    store,
    getOrCreateMetric(name) {
      if (!store.has(name)) store.set(name, { callCount: 0, incrementCallCount(n = 1) { this.callCount += n }, recordValue() {} })
      return store.get(name)
    },
    measureBytes() {}
  }
}

function makeTx(txMetrics) {
  return {
    metrics: txMetrics,
    trace: {
      attributes: { addAttribute() {} }
    }
  }
}

function makeData(topic, byteLength) {
  return {
    topic,
    message: { value: byteLength ? { byteLength } : null }
  }
}

// ── cluster consume metric ───────────────────────────────────────────────────

test('records cluster consume metric when clusterId and agentMetrics are present', () => {
  const txMetrics = makeMetrics()
  const agentMetrics = makeMetrics()
  const tx = makeTx(txMetrics)
  const kafkaCtx = { clusterId: 'cluster-xyz', clientId: 'client-1' }

  recordDataMetrics({ data: makeData('my-topic'), kafkaCtx, tx, agentMetrics })

  const key = 'MessageBroker/Kafka/Cluster/cluster-xyz/Topic/my-topic/Consume'
  assert.ok(agentMetrics.store.has(key), `Expected metric '${key}' to be recorded`)
  assert.strictEqual(agentMetrics.store.get(key).callCount, 1)
})

test('does not record cluster consume metric when clusterId is missing', () => {
  const txMetrics = makeMetrics()
  const agentMetrics = makeMetrics()
  const tx = makeTx(txMetrics)
  const kafkaCtx = { clientId: 'client-1' }

  recordDataMetrics({ data: makeData('my-topic'), kafkaCtx, tx, agentMetrics })

  assert.strictEqual(agentMetrics.store.size, 0)
})

test('does not record cluster consume metric when agentMetrics is absent', () => {
  const txMetrics = makeMetrics()
  const tx = makeTx(txMetrics)
  const kafkaCtx = { clusterId: 'cluster-xyz', clientId: 'client-1' }

  assert.doesNotThrow(() => recordDataMetrics({ data: makeData('my-topic'), kafkaCtx, tx }))
})

test('returns early without recording anything when tx is falsy', () => {
  const agentMetrics = makeMetrics()
  assert.doesNotThrow(() => recordDataMetrics({ data: makeData('my-topic'), kafkaCtx: {}, tx: null, agentMetrics }))
  assert.strictEqual(agentMetrics.store.size, 0)
})
