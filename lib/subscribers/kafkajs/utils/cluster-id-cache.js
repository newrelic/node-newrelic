/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MAX_CACHE_SIZE = 128
const TTL_MS = 30 * 60 * 1000

function _isExpired(entry) {
  return (Date.now() - entry.fetchedAt) > TTL_MS
}

/**
 * @param {Map} cache  Broker-key → { clusterId, fetchedAt } map owned by the caller.
 * @param {Array} brokers Broker connection strings, e.g. `['host:9092']`.
 * @returns {string|undefined}
 */
function getClusterIdFromCache(cache, brokers) {
  if (!Array.isArray(brokers) || brokers.length === 0) return undefined
  const key = brokers.slice().sort().join(',')
  const entry = cache.get(key)
  if (entry === undefined) return undefined
  if (_isExpired(entry)) return undefined
  return entry.clusterId
}

/**
 * Fetches the Kafka cluster UUID via AdminClient and stores it in caller-owned maps.
 * Concurrent calls for the same broker set share a single in-flight promise.
 * Re-fetches after TTL expiry; returns stale value while re-fetch is in progress.
 * Silently returns null on any error (best-effort).
 *
 * @param {Map} cache     Broker-key → { clusterId, fetchedAt }.
 * @param {Map} inFlight  Broker-key → in-flight Promise.
 * @param {object} client kafkajs client instance.
 * @param {Array} brokers Broker connection strings, e.g. `['host:9092']`.
 * @returns {Promise<string|null>}
 */
function fetchAndCacheClusterId(cache, inFlight, client, brokers) {
  if (!Array.isArray(brokers) || brokers.length === 0) return Promise.resolve(null)
  const key = brokers.slice().sort().join(',')

  const existing = cache.get(key)
  if (existing !== undefined && !_isExpired(existing)) {
    return Promise.resolve(existing.clusterId)
  }
  if (inFlight.has(key)) return inFlight.get(key)

  const TIMEOUT_MS = 5000
  let admin
  let timeoutHandle
  const promise = (async () => {
    try {
      admin = client.admin()
      const timeout = new Promise((_resolve, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('NR Kafka cluster ID fetch timed out')),
          TIMEOUT_MS
        )
        if (typeof timeoutHandle.unref === 'function') timeoutHandle.unref()
      })
      await Promise.race([admin.connect(), timeout])
      const { clusterId } = await Promise.race([admin.describeCluster(), timeout])
      if (clusterId) {
        if (cache.size >= MAX_CACHE_SIZE && !cache.has(key)) {
          cache.delete(cache.keys().next().value)
        }
        cache.set(key, { clusterId, fetchedAt: Date.now() })
      }
      await admin.disconnect()
      admin = null
      return clusterId ?? null
    } catch {
      try { if (admin) await admin.disconnect() } catch { /* ignore */ }
      return null
    } finally {
      clearTimeout(timeoutHandle)
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, promise)
  return promise
}

module.exports = { getClusterIdFromCache, fetchAndCacheClusterId }
