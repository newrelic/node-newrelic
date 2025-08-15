/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

/**
 * Base class for defining a subscriber.
 * events property is an array with the following possible event names:
 *  `start`, `end`, `asyncStart`, `asyncEnd`, `error`
 *  @link https://nodejs.org/api/diagnostics_channel.html#class-tracingchannel
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
    this.prefix = 'orchestrion:'
    this.requireActiveTx = true
    this.id = `${this.prefix}${this.packageName}:${this.channelName}`
    this.channel = tracingChannel(this.id)
    this.store = agent.tracer._contextManager._asyncLocalStorage
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
    const segment = this.agent.tracer.createSegment({
      name,
      parent: ctx?.segment,
      recorder,
      transaction: ctx?.transaction,
    })

    if (segment) {
      segment.opaque = this.opaque
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
