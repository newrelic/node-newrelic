/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { AsyncLocalStorage } = require('node:async_hooks')
const { kafkaCluster } = require('#agentlib/symbols.js')
const ConsumerClusterCaptureSubscriber = require('#agentlib/subscribers/kafkajs/consumer-cluster-capture.js')

function makeSubscriber({ kafkajsInstrumentation = true } = {}) {
  const als = new AsyncLocalStorage()
  const agent = {
    config: { feature_flag: { kafkajs_instrumentation: kafkajsInstrumentation } },
    tracer: { _contextManager: { _asyncLocalStorage: als } }
  }
  const logger = { child: () => { return { debug() {}, info() {}, warn() {}, error() {} } } }
  return new ConsumerClusterCaptureSubscriber({ agent, logger })
}

test('end(): stashes the cluster reference on the created consumer', () => {
  const subscriber = makeSubscriber()
  const cluster = { brokerPool: { metadata: { clusterId: 'cluster-1' } } }
  const consumer = {}
  subscriber.end({ arguments: [{ cluster, groupId: 'group-1' }], result: consumer }, {})
  assert.strictEqual(consumer[kafkaCluster], cluster)
})

test('end(): does nothing when the factory params have no cluster', () => {
  const subscriber = makeSubscriber()
  const consumer = {}
  subscriber.end({ arguments: [{ groupId: 'group-1' }], result: consumer }, {})
  assert.strictEqual(consumer[kafkaCluster], undefined)
})

test('end(): does nothing when there is no result', () => {
  const subscriber = makeSubscriber()
  const cluster = { brokerPool: { metadata: { clusterId: 'cluster-1' } } }
  assert.doesNotThrow(() => subscriber.end({ arguments: [{ cluster }], result: undefined }, {}))
})

test('enabled: false when kafkajs_instrumentation feature flag is disabled', () => {
  const subscriber = makeSubscriber({ kafkajsInstrumentation: false })
  assert.strictEqual(subscriber.enabled, false)
})
