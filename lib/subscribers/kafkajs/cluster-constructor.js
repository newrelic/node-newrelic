/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base.js')

/**
 * The `kafkajs` library exports a `Client` class whose `.consumer()` and
 * `.producer()` methods each construct their own private, internal `Cluster`
 * instance. That `Cluster` is never exposed on the returned producer/consumer
 * object, but it is the only place `cluster_id` can be observed (via its
 * `brokerPool`'s metadata). This subscriber exists solely to capture a
 * reference to each newly constructed `Cluster` so that `ConstructorSubscriber`
 * (in `./client-constructor.js`) can pick it up immediately afterward, via
 * the static `pendingCluster` slot below.
 *
 * @type {ClusterConstructorSubscriber}
 */
module.exports = class ClusterConstructorSubscriber extends Subscriber {
  /**
   * A single-slot handoff to `ConstructorSubscriber`. Because `kafka.producer()`
   * and `kafka.consumer()` construct their `Cluster` synchronously and JS is
   * single-threaded, whatever is in `current` immediately after one of those
   * calls returns is guaranteed to be the `Cluster` instance that call just
   * created.
   */
  static pendingCluster = { current: null }

  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_cluster_constructor', packageName: 'kafkajs' })
    this.requireActiveTx = false
    this.events = ['end']
  }

  get enabled() {
    if (this.agent.config.feature_flag.kafkajs_instrumentation === false) {
      this.logger.debug(
        '`config.feature_flag.kafkajs_instrumentation is false, skipping instrumentation of kafkajs`'
      )
      return false
    }

    if (this.agent.config.kafka.metrics.cluster.metrics.enabled !== true) {
      this.logger.debug(
        '`config.kafka.metrics.cluster.metrics.enabled is false, skipping cluster id capture`'
      )
      return false
    }

    return super.enabled
  }

  /**
   * Picks up the data returned from the `kafkajs.Cluster` constructor.
   *
   * @param {SubscriberHandlerData} data Data from Orchestrion.
   * @param {SubscriberHandlerContext} ctx Context from Orchestrion.
   *
   * @returns {SubscriberHandlerContext}
   */
  end(data, ctx) {
    ClusterConstructorSubscriber.pendingCluster.current = data.self
    return ctx
  }
}
