/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * This is an interface class. It defines the methods each subclass _must_
 * implement and override in order for the diagnostics channel or tracing
 * channel subscriptions to work.
 *
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {object} config The agent configuration object.
 * @property {string} packageName The name of the module being instrumented.
 * This is the same string one would pass to the `require` function.
 * @property {string} id An alias for `packageName`.
 *
 * @private
 * @interface
 */
class Subscriber {
  #agent
  #config
  #logger
  #packageName

  constructor({ agent, logger, packageName }) {
    this.#agent = agent
    this.#config = agent.config
    this.#logger = logger.child({ component: `${packageName}-subscriber` })
    this.#packageName = packageName
  }

  get [Symbol.toStringTag]() {
    return 'Subscriber'
  }

  get agent() {
    return this.#agent
  }

  get config() {
    return this.#config
  }

  get id() {
    return this.#packageName
  }

  get logger() {
    return this.#logger
  }

  get packageName() {
    return this.#packageName
  }

  /**
   * Indicates if the subscription should be enabled or not. The most likely
   * scenario is that an implementation will consult the agent configuration
   * to determine the result.
   *
   * @returns {boolean} Subscriber is enabled or not.
   */
  get enabled() {
    throw Error('enabled is not implemented on class: ' + this.constructor.name)
  }

  /**
   * Implementations should utilize subclass specific configuration or logic
   * to enable the subscriber. This is basically a start-up lifecycle hook
   * that the implementation can use to perform necessary actions, e.g.
   * creating an asynchronous context and binding it to an appropriate channel.
   *
   * @returns {void | Function | boolean} Result of the enablement. Not likely
   * to be used.
   */
  enable() {
    throw Error('enable is not implemented on class: ' + this.constructor.name)
  }

  /**
   * The inverse of the `enable` method. It's basically an agent shutdown
   * lifecycle hook. Any clean up logic required as a result of the work
   * performed in the `enable` method should be hosted here.
   *
   * @returns {void | boolean} Result of the disablement. Not likely to be
   * used.
   */
  disable() {
    throw Error('disable is not implemented on class: ' + this.constructor.name)
  }

  /**
   * Classes must implement this method. It is expected to read some
   * configuration data, specific to the subclass, and utilize it to
   * perform the channel subscriptions.
   *
   * @returns {void}
   *
   * @example A basic "Diagnostics Channel" based method.
   * const dc = require('node:diagnostics_channel')
   * for (const sub of this.#subscriptions) {
   *   dc.subscribe(sub.channelName, sub.hook.bind(this))
   * }
   */
  subscribe() {
    throw Error('subscribe is not implemented on class: ' + this.constructor.name)
  }

  /**
   * The inverse of the `subscribe` method. This should iterate through the
   * subscribed channels and issue any unsubscribe and clean-up logic for them.
   *
   * @returns {void}
   */
  unsubscribe() {
    throw Error('unsubscribe is not implemented on class: ' + this.constructor.name)
  }
}

module.exports = Subscriber
