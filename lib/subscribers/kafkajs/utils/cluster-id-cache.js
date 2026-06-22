/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const _clusterIdCache = new Map()
const _clusterIdInFlight = new Map()

function getClusterIdFromCache(brokers) {
  if (!Array.isArray(brokers) || brokers.length === 0) return undefined
  const key = brokers.slice().sort().join(',')
  return _clusterIdCache.get(key)
}

function fetchAndCacheClusterId(client, brokers) {
  if (!Array.isArray(brokers) || brokers.length === 0) return Promise.resolve(null)
  const key = brokers.slice().sort().join(',')

  if (_clusterIdCache.has(key)) return Promise.resolve(_clusterIdCache.get(key))
  if (_clusterIdInFlight.has(key)) return _clusterIdInFlight.get(key)

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
      if (clusterId) _clusterIdCache.set(key, clusterId)
      await admin.disconnect()
      admin = null
      return clusterId ?? null
    } catch {
      try { if (admin) await admin.disconnect() } catch { /* ignore */ }
      return null
    } finally {
      clearTimeout(timeoutHandle)
      _clusterIdInFlight.delete(key)
    }
  })()

  _clusterIdInFlight.set(key, promise)
  return promise
}

module.exports = { getClusterIdFromCache, fetchAndCacheClusterId }
