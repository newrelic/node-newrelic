/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const dc = require('node:diagnostics_channel')
const recordSupportabilityMetric = require('./record-supportability-metric.js')
const resolvePackageVersion = require('./resolve-package-version.js')

/**
 * The baseline parameters available to all subscribers.
 *
 * @typedef {object} SubscriberParams
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {string} packageName The package name being instrumented.
 * This is what a developer would provide to the `require` function.
 * @property {boolean} [skipUsageMetricRecording=false] When set to `true`, the
 * instrumentation will not attempt to record the usage metric. This is useful
 * when the module being instrumented is also being instrumented via the
 * Orchestrion based subscriber system. It is much cheaper to record the metric
 * via Orchestrion based subscribers than through this direct diagnostics
 * channel method (Orchestrion provides the module version, whereas we have
 * to perform expensive operations here to get the same information).
 */

/**
 * @typedef {object} ChannelDescriptor
 * @property {string} channel The fully qualified name of a diagnostic channel,
 * e.g. `undici:request:create`.
 * @property {Function} hook The function to execute when the channel is fired.
 * This function will be bound to the `Subscriber` instance.
 */

/**
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {ChannelDescriptor[]} channels The channels to subscribe to.
 * @property {object} logger An agent logger instance.
 * @property {object} config The agent configuration object.
 * @property {string} id The name of the module being instrumented.
 * This is the same string one would pass to the `require` function.
 */
class Subscriber {
  #usageMetricRecorded = false

  /**
   * @param {SubscriberParams} params to function
   */
  constructor({ agent, logger, packageName, skipUsageMetricRecording = false }) {
    this.agent = agent
    this.logger = logger.child({ component: `${packageName}-subscriber` })
    this.config = agent.config
    this.id = packageName

    if (skipUsageMetricRecording === true) {
      this.#usageMetricRecorded = true
    }
  }

  set channels(channels) {
    if (!Array.isArray(channels)) {
      throw new Error('channels must be a collection of objects with properties channel and hook')
    }
    this._channels = channels
  }

  get channels() {
    return this._channels
  }

  /**
   * Checks if the subscriber is enabled based on the agent's configuration.
   * @returns {boolean} if subscriber is enabled
   */
  get enabled() {
    return this.config.instrumentation[this.id].enabled === true
  }

  enable() {
    return true
  }

  disable() {
    return true
  }

  subscribe() {
    for (let index = 0; index < this.channels.length; index++) {
      const chan = this.channels[index]
      const { hook, channel } = this.channels[index]
      const boundHook = hook.bind(this)
      chan.boundHook = boundHook
      chan.eventHandler = (message, name) => {
        this.#supportability()
        boundHook(message, name)
      }
      dc.subscribe(channel, chan.eventHandler)
    }
  }

  unsubscribe() {
    for (let index = 0; index < this.channels.length; index++) {
      const { channel, eventHandler } = this.channels[index]
      dc.unsubscribe(channel, eventHandler)
    }
  }

  /**
   * Since this class subscribes to diagnostics channels natively published by
   * target modules, we do not get the package metadata that Orchestrion
   * provides in its channel events. So we have to try and find the package
   * manifest and get the version out of it in order to record our
   * supportability metric.
   */
  #supportability() {
    if (this.#usageMetricRecorded === true) {
      return
    }
    const version = resolvePackageVersion(this.id)
    recordSupportabilityMetric({
      agent: this.agent,
      moduleName: this.id,
      moduleVersion: version
    })
    this.#usageMetricRecorded = true
  }
}

module.exports = Subscriber
