/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base.js')
const { kafkaCluster } = require('#agentlib/symbols.js')

/**
 * kafkajs constructs a brand new internal `Cluster` instance on every call
 * to `Kafka.prototype.producer()` — it is not reachable from the top-level
 * `Kafka` client. This subscriber intercepts the internal producer factory
 * (`kafkajs/src/producer/index.js`) at the point where kafkajs itself
 * passes the freshly created `cluster` in, and stashes a reference to it on
 * the returned producer instance so `read-cluster-id.js` can read the
 * cluster id straight off it later — no admin connection, no cache needed.
 *
 * @type {ProducerClusterCaptureSubscriber}
 */
module.exports = class ProducerClusterCaptureSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_producerClusterCapture', packageName: 'kafkajs' })
    this.requireActiveTx = false
    this.events = ['end']
  }

  get enabled() {
    if (this.agent.config.feature_flag.kafkajs_instrumentation === false) {
      return false
    }

    return super.enabled
  }

  end(data, ctx) {
    const cluster = data?.arguments?.[0]?.cluster
    if (cluster && data.result) {
      data.result[kafkaCluster] = cluster
    }
    return ctx
  }
}
