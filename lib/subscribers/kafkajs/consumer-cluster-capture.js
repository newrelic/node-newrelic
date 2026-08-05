/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base.js')
const { kafkaCluster } = require('#agentlib/symbols.js')

/**
 * Same capture as `producer-cluster-capture.js`, but for the internal
 * consumer factory (`kafkajs/src/consumer/index.js`) — kafkajs also
 * constructs a brand new `Cluster` instance on every call to
 * `Kafka.prototype.consumer()`.
 *
 * @type {ConsumerClusterCaptureSubscriber}
 */
module.exports = class ConsumerClusterCaptureSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_consumerClusterCapture', packageName: 'kafkajs' })
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
