/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = recordLinkingMetrics

/**
 * Adds, or increments, a metric for each broker being communicated with
 * either during production or consumption of messages. When available, and
 * enabled via `config.kafka.metrics.cluster.metrics.enabled`, also adds, or
 * increments, a metric for the Kafka cluster identified by `clusterId`. Both
 * sets of metrics are incremented at the same frequency, i.e. once per
 * invocation, as they exist to power entity relationships rather than to
 * report exact message counts.
 *
 * @param {object} param Function parameters.
 * @param {Agent} param.agent The current agent instance.
 * @param {string[]} param.brokers The list of brokers the `kafkajs` client
 * was configured to communicate with.
 * @param {string} param.topic The remote Kafka topic the client is sending to
 * or receiving messages from.
 * @param {boolean} param.producer When `true`, indicates that the communication
 * is outgoing. Otherwise, it is an incoming metric.
 * @param {string} [param.clusterId] The identified Kafka cluster's id. Not
 * always known, e.g. it is resolved asynchronously and may not yet be
 * available on the first invocation for a given producer/consumer.
 */
function recordLinkingMetrics({ agent, brokers, topic, producer = true, clusterId }) {
  const kind = producer === true ? 'Produce' : 'Consume'
  for (const broker of brokers) {
    agent.metrics
      .getOrCreateMetric(`MessageBroker/Kafka/Nodes/${broker}/${kind}/${topic}`)
      .incrementCallCount()
  }

  if (agent.config.kafka.metrics.cluster.metrics.enabled === true && clusterId) {
    agent.metrics
      .getOrCreateMetric(`MessageBroker/Kafka/Cluster/${clusterId}/${kind}/${topic}`)
      .incrementCallCount()
  }
}
