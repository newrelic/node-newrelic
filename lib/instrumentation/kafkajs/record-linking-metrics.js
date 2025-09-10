/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = recordLinkingMetrics

/**
 *
 * @param root0
 * @param root0.agent
 * @param root0.brokers
 * @param root0.topic
 * @param root0.producer
 */
function recordLinkingMetrics({ agent, brokers, topic, producer = true }) {
  const kind = producer === true ? 'Produce' : 'Consume'
  for (const broker of brokers) {
    agent.metrics
      .getOrCreateMetric(`MessageBroker/Kafka/Nodes/${broker}/${kind}/${topic}`)
      .incrementCallCount()
  }
}
