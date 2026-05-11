/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = recordLinkingMetrics

/**
 * Adds, or increments, a metric for each broker being communicated with
 * either during production or consumption of messages.
 *
 * @param {object} param Function parameters.
 * @param {Agent} param.agent The current agent instance.
 * @param {string[]} param.brokers The list of brokers the `kafkajs` client
 * was configured to communicate with.
 * @param {string} param.topic The remote Kafka topic the client is sending to
 * or receiving messages from.
 * @param {boolean} param.producer When `true`, indicates that the communication
 * is outgoing. Otherwise, it is an incoming metric.
 */
function recordLinkingMetrics({ agent, brokers, topic, producer = true }) {
  const kind = producer === true ? 'Produce' : 'Consume'
  for (const broker of brokers) {
    agent.metrics
      .getOrCreateMetric(`MessageBroker/Kafka/Nodes/${broker}/${kind}/${topic}`)
      .incrementCallCount()
  }
}
