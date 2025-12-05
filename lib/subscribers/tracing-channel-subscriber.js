/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const dc = require('node:diagnostics_channel')
const Subscriber = require('./subscriber.js')

/**
 * A `TracingChannelSubscription` is an object that provides the channel name
 * and event handlers for a tracing channel. It provides an easy to validate
 * object with access to necessary event handlers.
 */
class TracingChannelSubscription {
  #channel
  #start
  #end
  #asyncStart
  #asyncEnd
  #error

  /**
   * Create a new instance. All event handlers are optional. Any event handler
   * not provided will be registered to a no-operation function.
   *
   * @param {object} params Constructor parameters object.
   * @param {string} params.channel The name of the tracing channel to monitor.
   * @param {Function} [params.start] The callback to invoke on start events.
   * @param {Function} [params.end] The callback to invoke on end events.
   * @param {Function} [params.asyncStart] The callback to invoke on asyncStart events.
   * @param {Function} [params.asyncEnd] The callback to invoke on asyncEnd events.
   * @param {Function} [params.error] The callback to invoke on error events.
   */
  constructor ({ channel, start, end, asyncStart, asyncEnd, error }) {
    this.#channel = channel

    // It's annoying that we have to do it this way. If we were to use
    // `Object.defineProperties` then we wouldn't get IDE/editor support
    // for the methods.
    this.#start = start ?? noop
    this.#end = end ?? noop
    this.#asyncStart = asyncStart ?? noop
    this.#asyncEnd = asyncEnd ?? noop
    this.#error = error ?? noop

    function noop() {}
  }

  get [Symbol.toStringTag]() {
    return 'TracingChannelSubscription'
  }

  /**
   * The name of the channel this subscription targets. It should be the
   * fully qualified channel name, sans any event name.
   *
   * @example
   * const chan = diagnosticsChannel.tracingChannel('foo:bar:baz')
   * // name = `tracing:foo:bar:baz`
   * const sub = new TracingChannelSubscription({ channel: 'tracing:foo:bar:baz' })
   * console.log(sub.channel) // "tracing:foo:bar:baz"
   *
   * @returns {string} The tracing channel name.
   */
  get channel() {
    return this.#channel
  }

  /**
   * Function to handle `start` events.
   *
   * @returns {Function} Start event handler.
   */
  get start() {
    return this.#start
  }

  /**
   * Function to handle `end` events.
   *
   * @returns {Function} End event handler.
   */
  get end() {
    return this.#end
  }

  /**
   * Function to handle `asyncStart` events.
   *
   * @returns {Function} Async start event handler.
   */
  get asyncStart() {
    return this.#asyncStart
  }

  /**
   * Function to handle `asyncEnd` events.
   *
   * @returns {Function} Async end event handler.
   */
  get asyncEnd() {
    return this.#asyncEnd
  }

  /**
   * Function to handle `error` events.
   *
   * @returns {Function} Error event handler.
   */
  get error() {
    return this.#error
  }
}

/**
 * A `TracingChannelSubscriber` is used to interact with libraries that publish
 * [Tracing Channel]{@link https://nodejs.org/docs/latest/api/diagnostics_channel.html#class-tracingchannel}
 * instances. A tracing channel (TC) is a collection of diagnostics channels,
 * where each channel corresponds to a specific event in the lifecycle of a
 * traced operation.
 *
 * To be clear: this is meant to be used with libraries that publish their own
 * channels. Not with libraries that we have dynamically patched with injected
 * tracing channels. For those cases, use the class exported from `./base.js`,
 * or one of the subclasses of it.
 */
class TracingChannelSubscriber extends Subscriber {
  #tcSubs = []
  #registeredSubs = []
  #events = ['start', 'end', 'asyncStart', 'asyncEnd', 'error']

  constructor({ agent, logger, packageName }) {
    super({ agent, logger, packageName })
  }

  get [Symbol.toStringTag]() {
    return 'TracingChannelSubscriber'
  }

  /**
   * Define the object that contains the subscription channel name and
   * event callbacks.
   *
   * @param {TracingChannelSubscription[]} tcSubs An object with event listeners
   * and the channel name.
   */
  set subscriptions(tcSubs) {
    const validated = []
    for (const sub of tcSubs) {
      if (Object.prototype.toString.call(sub) !== '[object TracingChannelSubscription]') {
        this.logger.warn('attempted to set subscriptions with an invalid object')
        return
      }
      validated.push(sub)
    }
    Array.prototype.push.apply(this.#tcSubs, validated)
  }

  /**
   * Whether the instance is enabled or not. This is accomplished by matching
   * the key name exported from the instrumentations `config.js` with the
   * `packageName` provided at construction.
   *
   * @returns {boolean} `true` for an enabled subscriber.
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
    for (const sub of this.#tcSubs) {
      const { channel } = sub
      for (const event of this.#events) {
        const chan = `${channel}:${event}`
        const fn = sub[event].bind(this)
        dc.subscribe(chan, fn)
        this.#registeredSubs.push([chan, fn])
      }
    }
  }

  unsubscribe() {
    for (const [chan, fn] of this.#registeredSubs) {
      dc.unsubscribe(chan, fn)
    }
  }
}

module.exports = {
  TracingChannelSubscription,
  TracingChannelSubscriber
}
