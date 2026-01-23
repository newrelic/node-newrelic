/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('../base')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const { extractLlmContext } = require('#agentlib/util/llm-utils.js')

class AiMonitoringSubscriber extends Subscriber {
  /**
   * @param {object} params constructor params object
   * @param {object} params.agent A New Relic Node.js agent instance.
   * @param {object} params.logger An agent logger instance.
   * @param {string} params.packageName The package name being instrumented.
   * This is what a developer would provide to the `require` function.
   * @param {string} params.channelName A unique name for the diagnostics channel
   * that will be created and monitored.
   * @param {string} params.name name of segment for a given subscriber
   * @param {string} params.trackingPrefix prefix for the tracking metric for a given subscriber
   */
  constructor({ agent, logger, packageName, channelName, name, trackingPrefix }) {
    super({ agent, logger, packageName, channelName })
    this.name = name
    this.trackingPrefix = trackingPrefix
  }

  get enabled() {
    return super.enabled && this.agent.config.ai_monitoring.enabled === true
  }

  set name(name) {
    if (!name) {
      throw new Error('subscriber must pass in `name`')
    }
    this._name = name
  }

  get name() {
    return this._name
  }

  set trackingPrefix(prefix) {
    if (!prefix) {
      throw new Error('subscriber must pass in `trackingPrefix`')
    }
    this._prefix = prefix
  }

  get trackingPrefix() {
    return this._prefix
  }

  /**
   * Increments the tracking metric and sets the llm attribute on transactions
   *
   * @param {object} params input params
   * @param {Transaction} params.ctx active context
   * @param {string} params.version package version
   */
  addLlmMeta({ ctx, version }) {
    if (!ctx?.transaction) {
      return
    }

    const transaction = ctx.transaction
    const trackingMetric = `${this.trackingPrefix}/${version}`
    this.agent.metrics.getOrCreateMetric(trackingMetric).incrementCallCount()
    transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
  }

  /**
   * Enqueues a LLM event to the custom event aggregator
   *
   * @param {object} params input params
   * @param {string} params.type LLM event type
   * @param {object} params.msg LLM event
   */
  recordEvent({ type, msg }) {
    const llmContext = extractLlmContext(this.agent)
    // prefer timestamp on event if present, otherwise use `Date.now`
    const timestamp = msg?.timestamp ?? Date.now()
    this.agent.customEventAggregator.add([
      { type, timestamp },
      Object.assign({}, msg, llmContext)
    ])
  }

  /**
   * Defines the common handler for all AIM calls.
   * All of these calls simply create a segment with a name
   * The `this.name` must be defined in the inherited subscriber
   * @param {object} data event passed to handler
   * @param {Context} ctx context passed to handler
   * @returns {Context} either new context or existing
   */
  handler(data, ctx) {
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, not creating segment.')
      return ctx
    }

    this.addLlmMeta({ ctx, version: data.moduleVersion })

    return this.createSegment({
      name: this.name,
      ctx
    })
  }
}

module.exports = AiMonitoringSubscriber
