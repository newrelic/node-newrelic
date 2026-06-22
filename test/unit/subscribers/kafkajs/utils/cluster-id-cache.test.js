/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { getClusterIdFromCache, _fetchAndCacheClusterId } = require('#agentlib/subscribers/kafkajs/utils/cluster-id-cache.js')

// Module-level Maps persist across tests; use unique broker strings per test to prevent contamination.
let _counter = 0
function uniqueBrokers(n = 1) {
  const prefix = `test-host-${++_counter}`
  return Array.from({ length: n }, (_, i) => `${prefix}-${i}:909${i}`)
}

function makeClient(clusterId, { connectError, describeError } = {}) {
  return {
    admin() {
      return {
        connect: () => connectError ? Promise.reject(connectError) : Promise.resolve(),
        describeCluster: () => describeError ? Promise.reject(describeError) : Promise.resolve({ clusterId }),
        disconnect: () => Promise.resolve()
      }
    }
  }
}

// ── getClusterIdFromCache ────────────────────────────────────────────────────

test('getClusterIdFromCache returns undefined for null', () => {
  assert.strictEqual(getClusterIdFromCache(null), undefined)
})

test('getClusterIdFromCache returns undefined for undefined', () => {
  assert.strictEqual(getClusterIdFromCache(undefined), undefined)
})

test('getClusterIdFromCache returns undefined for a string', () => {
  assert.strictEqual(getClusterIdFromCache('localhost:9092'), undefined)
})

test('getClusterIdFromCache returns undefined for a function', () => {
  assert.strictEqual(getClusterIdFromCache(() => ['localhost:9092']), undefined)
})

test('getClusterIdFromCache returns undefined for an empty array', () => {
  assert.strictEqual(getClusterIdFromCache([]), undefined)
})

test('getClusterIdFromCache returns undefined on cache miss', () => {
  assert.strictEqual(getClusterIdFromCache(uniqueBrokers()), undefined)
})

test('getClusterIdFromCache returns the cluster ID after a successful fetch', async () => {
  const brokers = uniqueBrokers(2)
  await _fetchAndCacheClusterId(makeClient('cluster-hit'), brokers)
  assert.strictEqual(getClusterIdFromCache(brokers), 'cluster-hit')
})

test('getClusterIdFromCache normalizes broker order for lookup', async () => {
  const brokers = uniqueBrokers(2)
  await _fetchAndCacheClusterId(makeClient('cluster-order'), brokers)
  assert.strictEqual(getClusterIdFromCache([...brokers].reverse()), 'cluster-order')
})

// ── _fetchAndCacheClusterId ──────────────────────────────────────────────────

test('_fetchAndCacheClusterId returns null for a non-array broker list', async () => {
  assert.strictEqual(await _fetchAndCacheClusterId(makeClient('x'), null), null)
})

test('_fetchAndCacheClusterId returns null for an empty broker array', async () => {
  assert.strictEqual(await _fetchAndCacheClusterId(makeClient('x'), []), null)
})

test('_fetchAndCacheClusterId returns the cached value without calling admin again', async () => {
  const brokers = uniqueBrokers()
  let adminCalls = 0
  const client = {
    admin() {
      adminCalls++
      return {
        connect: () => Promise.resolve(),
        describeCluster: () => Promise.resolve({ clusterId: 'cluster-cached' }),
        disconnect: () => Promise.resolve()
      }
    }
  }
  await _fetchAndCacheClusterId(client, brokers)
  assert.strictEqual(adminCalls, 1)
  await _fetchAndCacheClusterId(client, brokers)
  assert.strictEqual(adminCalls, 1)
})

test('_fetchAndCacheClusterId deduplicates concurrent in-flight requests', async () => {
  const brokers = uniqueBrokers()
  const client = makeClient('cluster-inflight')
  const p1 = _fetchAndCacheClusterId(client, brokers)
  const p2 = _fetchAndCacheClusterId(client, brokers)
  assert.strictEqual(p1, p2)
  await p1
})

test('_fetchAndCacheClusterId fetches and caches the cluster ID on success', async () => {
  const brokers = uniqueBrokers(3)
  const result = await _fetchAndCacheClusterId(makeClient('cluster-success'), brokers)
  assert.strictEqual(result, 'cluster-success')
  assert.strictEqual(getClusterIdFromCache(brokers), 'cluster-success')
})

test('_fetchAndCacheClusterId returns null when connect throws', async () => {
  const brokers = uniqueBrokers()
  const result = await _fetchAndCacheClusterId(
    makeClient(null, { connectError: new Error('connection refused') }),
    brokers
  )
  assert.strictEqual(result, null)
})

test('_fetchAndCacheClusterId returns null when describeCluster throws', async () => {
  const brokers = uniqueBrokers()
  const result = await _fetchAndCacheClusterId(
    makeClient(null, { describeError: new Error('not authorized') }),
    brokers
  )
  assert.strictEqual(result, null)
})

test('_fetchAndCacheClusterId clears the in-flight entry after the promise settles', async () => {
  const brokers = uniqueBrokers()
  const p1 = _fetchAndCacheClusterId(makeClient('cluster-settled'), brokers)
  await p1
  const p2 = _fetchAndCacheClusterId(makeClient('cluster-settled'), brokers)
  assert.notStrictEqual(p1, p2)
  assert.strictEqual(await p2, 'cluster-settled')
})
