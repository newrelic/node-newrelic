/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')

/**
 * Inspects the `kafkajs` data object for information we are interested in
 * tracking and adds it to the transaction as metadata.
 *
 * @param {object} params Function parameters.
 * @param {object} params.data Data object as received during the consumption
 * of a message.
 * @param {object} params.kafkaCtx The local context store we add to the
 * consumer client.
 * @param {Transaction} params.tx The current transaction.
 */
module.exports = function recordDataMetrics({ data, kafkaCtx, tx }) {
  if (!tx) {
    return
  }

  const { metrics } = tx
  const { topic } = data
  const byteLength = data?.message.value?.byteLength
  const metricPrefix = `Message/Kafka/Topic/Named/${topic}/Received`

  // The count of messages is always 1 since we process them one at time.
  metrics.getOrCreateMetric(`${metricPrefix}/Messages`).recordValue(1)
  if (byteLength) {
    metrics.measureBytes(`${metricPrefix}/Bytes`, byteLength)
    tx.trace.attributes.addAttribute(
      DESTINATIONS.TRANS_SCOPE,
      'kafka.consume.byteCount',
      byteLength
    )
  }
  if (kafkaCtx?.clientId) {
    tx.trace.attributes.addAttribute(
      DESTINATIONS.TRANS_EVENT,
      'kafka.consume.client_id',
      kafkaCtx.clientId
    )
  }
}
