/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const dc = require('node:diagnostics_channel')

/**
 * The baseline parameters available to all subscribers.
 *
 * @typedef {object} SubscriberParams
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {string} packageName The package name being instrumented.
 * This is what a developer would provide to the `require` function.
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
  /**
   * @param {SubscriberParams} params to function
   */
  constructor({ agent, logger, packageName }) {
    this.agent = agent
    this.logger = logger.child({ component: `${packageName}-subscriber` })
    this.config = agent.config
    this.id = packageName
  }

  set channels(channels) {
    if (!Array.isArray(channels)) {
      throw new Error('channels must be a collection of with propertiesof channel and hook')
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
    this.channels.forEach(({ channel, hook }, index) => {
      const boundHook = hook.bind(this)
      dc.subscribe(channel, boundHook)
      this.channels[index].boundHook = boundHook
    })
  }

  unsubscribe() {
    this.channels.forEach(({ channel, boundHook }) => {
      dc.unsubscribe(channel, boundHook)
    })
  }
}

module.exports = Subscriber
