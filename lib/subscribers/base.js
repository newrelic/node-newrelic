/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

/**
 * The baseline parameters available to all subscribers.
 *
 * @typedef {object} SubscriberParams
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {string} packageName The npm installable name for the package
 * being instrumented. This is what a developer would provide to the `require`
 * function.
 * @property {string} channelName A unique name for the diagnostics channel
 * that will be created and monitored.
 */

/**
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {TracingChannel} channel The tracing channel instance this
 * subscriber will be monitoring.
 * @property {string} channelName A unique name for the diagnostics channel
 * that will be registered.
 * @property {string[]} [events=[]] Set of tracing channel event names to
 * register handlers for. For any name in the set, a corresponding method
 * must exist on the subscriber instance. The method will be passed the
 * event object. Possible event names are `start`, `end`, `asyncStart`,
 * `asyncEnd`, and `error`.
 * @property {object} logger An agent logger instance.
 * @property {string} packageName The name of the module being instrumented.
 * This is the same string one would pass to the `require` function.
 * @property {string} [prefix='orchestrion:'] String to prepend to diagnostics
 * channel event names. This provides a namespace for the events we are
 * injecting into a module.
 */
class Subscriber {
  /**
   * Create a new subscriber instance.
   *
   * @param {SubscriberParams} params The parameters for the subscriber.
   */
  constructor({ agent, logger, packageName, channelName }) {
    this.agent = agent
    this.logger = logger.child({ component: `${packageName}-subscriber` })
    this.config = agent.config
    this.packageName = packageName
    this.channelName = channelName
    this.events = []
    this.opaque = false
    this.prefix = 'orchestrion:'
    this.requireActiveTx = true
    this.id = `${this.prefix}${this.packageName}:${this.channelName}`
    this.channel = tracingChannel(this.id)
    this.store = agent.tracer._contextManager._asyncLocalStorage
  }

  get enabled() {
    return this.config.instrumentation[this.packageName].enabled === true
  }

  enable() {
    this.channel.start.bindStore(this.store, (data) => {
      const ctx = this.agent.tracer.getContext()
      if (this.requireActiveTx && !ctx?.transaction?.isActive()) {
        this.logger.debug('Not recording event for %s, transaction is not active', this.package)
        return
      }

      return this.handler(data, ctx)
    })
  }

  disable() {
    this.channel.start.unbindStore(this.store)
  }

  asyncEnd() {
    const ctx = this.agent.tracer.getContext()
    ctx?.segment?.touch()
  }

  subscribe() {
    this.subscriptions = this.events.reduce((events, curr) => {
      events[curr] = this[curr].bind(this)
      return events
    }, {})

    this.channel.subscribe(this.subscriptions)
  }

  unsubscribe() {
    this.channel.unsubscribe(this.subscriptions)
  }
}

module.exports = Subscriber
