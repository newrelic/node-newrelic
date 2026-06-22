/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MAX_CACHE_SIZE = 128

/**
 * @param {Map} cache  Broker-key → cluster UUID map owned by the caller.
 * @param {Array} brokers
 * @returns {string|undefined}
 */
function getClusterIdFromCache(cache, brokers) {
  if (!Array.isArray(brokers) || brokers.length === 0) return undefined
  const key = brokers.slice().sort().join(',')
  return cache.get(key)
}

/**
 * Fetches the Kafka cluster UUID via AdminClient and stores it in caller-owned maps.
 * Concurrent calls for the same broker set share a single in-flight promise.
 * Silently returns null on any error (best-effort).
 *
 * @param {Map} cache     Broker-key → cluster UUID.
 * @param {Map} inFlight  Broker-key → in-flight Promise.
 * @param {object} client kafkajs client instance.
 * @param {Array} brokers
 * @returns {Promise<string|null>}
 */
function fetchAndCacheClusterId(cache, inFlight, client, brokers) {
  if (!Array.isArray(brokers) || brokers.length === 0) return Promise.resolve(null)
  const key = brokers.slice().sort().join(',')

  if (cache.has(key)) return Promise.resolve(cache.get(key))
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
      if (clusterId && cache.size < MAX_CACHE_SIZE) cache.set(key, clusterId)
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
