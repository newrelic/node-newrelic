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
 * @property {object} logger An agent logger instance.
 * @property {object} config The agent configuration object.
 * @property {string} packageName The name of the module being instrumented.
 * This is the same string one would pass to the `require` function.
 * @property {string} channelName A unique name for the diagnostics channel
 * that will be registered.
 * @property {string[]} [events=[]] Set of tracing channel event names to
 * register handlers for. For any name in the set, a corresponding method
 * must exist on the subscriber instance. The method will be passed the
 * event object. Possible event names are `start`, `end`, `asyncStart`,
 * `asyncEnd`, and `error`. @link https://nodejs.org/api/diagnostics_channel.html#class-tracingchannel
 * @property {boolean} [opaque=false] If true, any children segments will not be created
 * @property {boolean} [internal=false] If true, any children segments from the same library will not be created
 * @property {string} [prefix='orchestrion:'] String to prepend to diagnostics
 * channel event names. This provides a namespace for the events we are
 * injecting into a module.
 * @property {boolean} [requireActiveTx=true] If true, the subscriber will only handle events when there is an active transaction.
 * @property {string} id A unique identifier for the subscriber, combining the prefix, package name, and channel name.
 * @property {TracingChannel} channel The tracing channel instance this subscriber will be monitoring.
 * @property {AsyncLocalStorage} store The async local storage instance used for context management.
 */
class Subscriber {
  constructor({ agent, logger, packageName, channelName }) {
    this.agent = agent
    this.logger = logger.child({ component: `${packageName}-subscriber` })
    this.config = agent.config
    this.packageName = packageName
    this.channelName = channelName
    this.events = []
    this.opaque = false
    this.internal = false
    this.prefix = 'orchestrion:'
    this.requireActiveTx = true
    this.id = `${this.prefix}${this.packageName}:${this.channelName}`
    this.channel = tracingChannel(this.id)
    this.store = agent.tracer._contextManager._asyncLocalStorage
  }

  shouldCreateSegment(parent) {
    return !(parent?.opaque ||
    (this.internal && this.packageName === parent?.shimId)
    )
  }

  /**
   * Creates a segment with a name, parent, transaction and optional recorder.
   * If the segment is successfully created, it will be started and added to the context.
   * @param {Object} params - Parameters for creating the segment
   * @param {string} params.name - The name of the segment
   * @param {Object} params.recorder - Optional recorder for the segment
   * @param {Context} params.ctx - The context containing the parent segment and transaction
   * @returns {Context} - The updated context with the new segment or existing context if segment creation fails
   */
  createSegment({ name, recorder, ctx }) {
    const parent = ctx?.segment

    if (this.shouldCreateSegment(parent) === false) {
      this.logger.trace('Skipping segment creation for %s, %s(parent) is of the same package: %s and incoming segment is marked as internal', name, parent?.name, this.packageName)
      return ctx
    }

    const segment = this.agent.tracer.createSegment({
      name,
      parent,
      recorder,
      transaction: ctx?.transaction,
    })

    if (segment) {
      segment.opaque = this.opaque
      segment.shimId = this.packageName
      segment.start()
      this.logger.trace('Created segment %s', name)
      this.addAttributes(segment)
      const newCtx = ctx.enterSegment({ segment })
      return newCtx
    } else {
      this.logger.trace('Failed to create segment for %s', name)
      return ctx
    }
  }

  /**
   * By default this is a no-op, but can be overridden by subclasses
   * @param {Segment} segment - The segment to which attributes will be added
   * @returns {void}
   */
  addAttributes(segment) {

  }

  /**
   * Checks if the subscriber is enabled based on the agent's configuration.
   */
  get enabled() {
    return this.config.instrumentation[this.packageName].enabled === true
  }

  /**
   * Enables the subscriber by binding the store to the channel and setting up the handler.
   * If the subscriber requires an active transaction, it will check the context before passing the event to the handler.
   * @returns {Context} - The context after processing the event
   */
  enable() {
    this.channel.start.bindStore(this.store, (data) => {
      const ctx = this.agent.tracer.getContext()
      if (this.requireActiveTx && !ctx?.transaction?.isActive()) {
        this.logger.debug('Not recording event for %s, transaction is not active', this.package)
        return ctx
      }

      return this.handler(data, ctx)
    })
  }

  /**
   * Disables the subscriber by unbinding the store from the channel.
   */
  disable() {
    this.channel.start.unbindStore(this.store)
  }

  /**
   * Common handler for when async events end.
   * It gets the context and touches the segment if it exists.
   */
  asyncEnd() {
    const ctx = this.agent.tracer.getContext()
    ctx?.segment?.touch()
  }

  /*
   * Subscribes to the events defined in the `events` array.
   */
  subscribe() {
    this.subscriptions = this.events.reduce((events, curr) => {
      events[curr] = this[curr].bind(this)
      return events
    }, {})

    this.channel.subscribe(this.subscriptions)
  }

  /**
   * Unsubscribes from the events defined in the `events` array..
   */
  unsubscribe() {
    this.channel.unsubscribe(this.subscriptions)
    this.subscriptions = null
  }
}

module.exports = Subscriber
