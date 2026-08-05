/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { kafkaCluster } = require('#agentlib/symbols.js')
const readClusterId = require('#agentlib/subscribers/kafkajs/utils/read-cluster-id.js')

function withCluster(clusterId) {
  const instance = {}
  instance[kafkaCluster] = { brokerPool: { metadata: { clusterId } } }
  return instance
}

test('returns the cluster id when present', () => {
  assert.strictEqual(readClusterId(withCluster('cluster-1')), 'cluster-1')
})

test('returns undefined when no cluster was captured', () => {
  assert.strictEqual(readClusterId({}), undefined)
})

test('returns undefined when instance is null/undefined', () => {
  assert.strictEqual(readClusterId(null), undefined)
  assert.strictEqual(readClusterId(undefined), undefined)
})

test('returns undefined when metadata has not been fetched yet', () => {
  const instance = {}
  instance[kafkaCluster] = { brokerPool: { metadata: null } }
  assert.strictEqual(readClusterId(instance), undefined)
})

test('returns undefined when clusterId is an empty string', () => {
  assert.strictEqual(readClusterId(withCluster('')), undefined)
})

test('returns undefined when clusterId is null', () => {
  assert.strictEqual(readClusterId(withCluster(null)), undefined)
})

test('returns undefined when clusterId is not a string', () => {
  assert.strictEqual(readClusterId(withCluster(42)), undefined)
})

test('does not throw when brokerPool getter throws', () => {
  const instance = {}
  Object.defineProperty(instance, kafkaCluster, {
    get() { throw new Error('boom') }
  })
  assert.strictEqual(readClusterId(instance), undefined)
})
