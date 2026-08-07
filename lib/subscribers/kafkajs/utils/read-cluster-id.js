/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { kafkaCluster } = require('#agentlib/symbols.js')

/**
 * Reads the Kafka cluster id off a producer/consumer instance. The `Cluster`
 * reference is captured at producer()/consumer() creation time (see
 * `producer-cluster-capture.js` / `consumer-cluster-capture.js`) and stashed
 * on the instance via the `kafkaCluster` symbol. kafkajs keeps
 * `cluster.brokerPool.metadata` current on its own as part of normal
 * operation, so this is a synchronous, in-memory, best-effort read — no
 * network call, no cache.
 *
 * @param {object} instance Producer or consumer client instance.
 * @returns {string|undefined} The cluster id, or `undefined` if not yet
 * available (e.g. a producer's very first send, before kafkajs has fetched
 * any metadata).
 */
module.exports = function readClusterId(instance) {
  try {
    const clusterId = instance?.[kafkaCluster]?.brokerPool?.metadata?.clusterId
    return typeof clusterId === 'string' && clusterId !== '' ? clusterId : undefined
  } catch {
    return undefined
  }
}
