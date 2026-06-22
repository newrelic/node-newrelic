/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Records MessageBroker/Kafka/Cluster cluster-level produce metrics.
 * For send() records one metric for the single topic.
 * For sendBatch() records one metric per distinct topic in the batch.
 *
 * @param {object} metrics The agent metrics aggregator.
 * @param {string} clusterId Kafka cluster UUID.
 * @param {boolean} batch Whether this is a sendBatch call.
 * @param {object} data The send/sendBatch arguments object.
 */
module.exports = function recordClusterProduceMetrics(metrics, clusterId, batch, data) {
  if (batch === false) {
    metrics
      .getOrCreateMetric(`MessageBroker/Kafka/Cluster/${clusterId}/Topic/${data.topic}/Produce`)
      .incrementCallCount(data.messages.length)
  } else {
    for (const topicMessage of data.topicMessages) {
      metrics
        .getOrCreateMetric(
          `MessageBroker/Kafka/Cluster/${clusterId}/Topic/${topicMessage.topic}/Produce`
        )
        .incrementCallCount(topicMessage.messages.length)
    }
  }
}
