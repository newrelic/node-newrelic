/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { getClusterIdFromCache, fetchAndCacheClusterId } = require('#agentlib/subscribers/kafkajs/utils/cluster-id-cache.js')

function freshMaps() {
  return { cache: new Map(), inFlight: new Map() }
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

const BROKERS = ['host-a:9092', 'host-b:9093']

// ── getClusterIdFromCache ────────────────────────────────────────────────────

test('getClusterIdFromCache returns undefined for null', () => {
  const { cache } = freshMaps()
  assert.strictEqual(getClusterIdFromCache(cache, null), undefined)
})

test('getClusterIdFromCache returns undefined for undefined', () => {
  const { cache } = freshMaps()
  assert.strictEqual(getClusterIdFromCache(cache, undefined), undefined)
})

test('getClusterIdFromCache returns undefined for a string', () => {
  const { cache } = freshMaps()
  assert.strictEqual(getClusterIdFromCache(cache, 'localhost:9092'), undefined)
})

test('getClusterIdFromCache returns undefined for a function', () => {
  const { cache } = freshMaps()
  assert.strictEqual(getClusterIdFromCache(cache, () => ['localhost:9092']), undefined)
})

test('getClusterIdFromCache returns undefined for an empty array', () => {
  const { cache } = freshMaps()
  assert.strictEqual(getClusterIdFromCache(cache, []), undefined)
})

test('getClusterIdFromCache returns undefined on cache miss', () => {
  const { cache } = freshMaps()
  assert.strictEqual(getClusterIdFromCache(cache, BROKERS), undefined)
})

test('getClusterIdFromCache returns the cluster ID after a successful fetch', async () => {
  const { cache, inFlight } = freshMaps()
  await fetchAndCacheClusterId(cache, inFlight, makeClient('cluster-hit'), BROKERS)
  assert.strictEqual(getClusterIdFromCache(cache, BROKERS), 'cluster-hit')
})

test('getClusterIdFromCache normalizes broker order for lookup', async () => {
  const { cache, inFlight } = freshMaps()
  await fetchAndCacheClusterId(cache, inFlight, makeClient('cluster-order'), BROKERS)
  assert.strictEqual(getClusterIdFromCache(cache, [...BROKERS].reverse()), 'cluster-order')
})

// ── fetchAndCacheClusterId ──────────────────────────────────────────────────

test('fetchAndCacheClusterId returns null for a non-array broker list', async () => {
  const { cache, inFlight } = freshMaps()
  assert.strictEqual(await fetchAndCacheClusterId(cache, inFlight, makeClient('x'), null), null)
})

test('fetchAndCacheClusterId returns null for an empty broker array', async () => {
  const { cache, inFlight } = freshMaps()
  assert.strictEqual(await fetchAndCacheClusterId(cache, inFlight, makeClient('x'), []), null)
})

test('fetchAndCacheClusterId returns the cached value without calling admin again', async () => {
  const { cache, inFlight } = freshMaps()
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
  await fetchAndCacheClusterId(cache, inFlight, client, BROKERS)
  assert.strictEqual(adminCalls, 1)
  await fetchAndCacheClusterId(cache, inFlight, client, BROKERS)
  assert.strictEqual(adminCalls, 1)
})

test('fetchAndCacheClusterId deduplicates concurrent in-flight requests', async () => {
  const { cache, inFlight } = freshMaps()
  const client = makeClient('cluster-inflight')
  const p1 = fetchAndCacheClusterId(cache, inFlight, client, BROKERS)
  const p2 = fetchAndCacheClusterId(cache, inFlight, client, BROKERS)
  assert.strictEqual(p1, p2)
  await p1
})

test('fetchAndCacheClusterId fetches and caches the cluster ID on success', async () => {
  const { cache, inFlight } = freshMaps()
  const result = await fetchAndCacheClusterId(cache, inFlight, makeClient('cluster-success'), BROKERS)
  assert.strictEqual(result, 'cluster-success')
  assert.strictEqual(getClusterIdFromCache(cache, BROKERS), 'cluster-success')
})

test('fetchAndCacheClusterId returns null when connect throws', async () => {
  const { cache, inFlight } = freshMaps()
  const result = await fetchAndCacheClusterId(
    cache, inFlight,
    makeClient(null, { connectError: new Error('connection refused') }),
    BROKERS
  )
  assert.strictEqual(result, null)
})

test('fetchAndCacheClusterId returns null when describeCluster throws', async () => {
  const { cache, inFlight } = freshMaps()
  const result = await fetchAndCacheClusterId(
    cache, inFlight,
    makeClient(null, { describeError: new Error('not authorized') }),
    BROKERS
  )
  assert.strictEqual(result, null)
})

test('fetchAndCacheClusterId clears the in-flight entry after the promise settles', async () => {
  const { cache, inFlight } = freshMaps()
  const p1 = fetchAndCacheClusterId(cache, inFlight, makeClient('cluster-settled'), BROKERS)
  await p1
  const p2 = fetchAndCacheClusterId(cache, inFlight, makeClient('cluster-settled'), BROKERS)
  assert.notStrictEqual(p1, p2)
  assert.strictEqual(await p2, 'cluster-settled')
})
