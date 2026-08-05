/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { AsyncLocalStorage } = require('node:async_hooks')
const { kafkaCluster } = require('#agentlib/symbols.js')
const ProducerClusterCaptureSubscriber = require('#agentlib/subscribers/kafkajs/producer-cluster-capture.js')

function makeSubscriber({ kafkajsInstrumentation = true } = {}) {
  const als = new AsyncLocalStorage()
  const agent = {
    config: { feature_flag: { kafkajs_instrumentation: kafkajsInstrumentation } },
    tracer: { _contextManager: { _asyncLocalStorage: als } }
  }
  const logger = { child: () => { return { debug() {}, info() {}, warn() {}, error() {} } } }
  return new ProducerClusterCaptureSubscriber({ agent, logger })
}

test('end(): stashes the cluster reference on the created producer', () => {
  const subscriber = makeSubscriber()
  const cluster = { brokerPool: { metadata: { clusterId: 'cluster-1' } } }
  const producer = {}
  subscriber.end({ arguments: [{ cluster }], result: producer }, {})
  assert.strictEqual(producer[kafkaCluster], cluster)
})

test('end(): does nothing when the factory params have no cluster', () => {
  const subscriber = makeSubscriber()
  const producer = {}
  subscriber.end({ arguments: [{}], result: producer }, {})
  assert.strictEqual(producer[kafkaCluster], undefined)
})

test('end(): does nothing when there is no result', () => {
  const subscriber = makeSubscriber()
  const cluster = { brokerPool: { metadata: { clusterId: 'cluster-1' } } }
  assert.doesNotThrow(() => subscriber.end({ arguments: [{ cluster }], result: undefined }, {}))
})

test('end(): returns the passed-through context', () => {
  const subscriber = makeSubscriber()
  const ctx = { some: 'context' }
  const cluster = { brokerPool: { metadata: { clusterId: 'cluster-1' } } }
  const result = subscriber.end({ arguments: [{ cluster }], result: {} }, ctx)
  assert.strictEqual(result, ctx)
})

test('enabled: false when kafkajs_instrumentation feature flag is disabled', () => {
  const subscriber = makeSubscriber({ kafkajsInstrumentation: false })
  assert.strictEqual(subscriber.enabled, false)
})
