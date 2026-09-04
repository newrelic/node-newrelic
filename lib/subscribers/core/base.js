/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

/**
 * The baseline parameters required to construct a core subscriber.
 *
 * @typedef {object} CoreSubscriberParams
 * @property {Agent} agent A New Relic Node.js agent instance.
 * @property {AgentLogger} logger An agent logger instance.
 * @property {string} packageName The Node.js core module being instrumented,
 * e.g. `'dns'` or `'fs'`. This is the string passed to `require`.
 * @property {string} [prefix] Optional namespace segment inserted between
 * `'nr:'` and `packageName` when building the channel id, e.g. `'promises'`
 * produces `'nr:promises:dns'`. Omit to use the short form `'nr:dns'`.
 * @property {string[]} [instrumentedMethods=[]] Names of the module methods
 * to instrument. One tracing channel is created per entry.
 * @property {boolean} [hasCallback=false] Set when the instrumented methods are
 * traced with `traceCallback`. Causes the segment created in `start` to be
 * stashed on the event data so `asyncEnd` can touch that exact segment.
 */

/**
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {Agent} config The agent configuration object.
 * @property {AgentLogger} logger A child logger scoped to this subscriber.
 * @property {string} packageName The name of the core module being instrumented.
 * @property {string} id Unique channel identifier of the form `nr:<packageName>`
 * or `nr:<prefix>:<packageName>`.
 * @property {TracingChannel[]} channels One tracing channel per instrumented
 * method, built from `instrumentedMethods`.
 * @property {AsyncLocalStorage} store The async local storage instance used
 * for context propagation.
 * @property {object} handlers Bound event handlers registered on each channel.
 * Always includes `asyncEnd` and `end`
 */
class BaseCoreSubscriber {
  /**
   * @param {CoreSubscriberParams} params the subscriber constructor params
   */
  constructor({ agent, logger, packageName, prefix, instrumentedMethods = [], hasCallback = false }) {
    this.agent = agent
    this.config = agent.config
    this.logger = logger.child({ component: `${packageName}-subscriber` })
    this.packageName = packageName
    this.hasCallback = hasCallback
    this.id = prefix ? `nr:${prefix}:${packageName}` : `nr:${packageName}`
    this.channels = this.buildChannels(instrumentedMethods)
    this.store = agent.tracer.store
    this.handlers = {
      asyncEnd: this.asyncEnd.bind(this),
      end: this.end.bind(this)
    }
  }

  /**
   * Checks whether instrumentation for this package is enabled in the agent
   * configuration.
   *
   * @returns {boolean} `true` when `config.instrumentation[packageName].enabled === true`
   */
  get enabled() {
    return this.config.instrumentation[this.packageName].enabled === true
  }

  /**
   * Creates one {@link TracingChannel} per method name, namespaced under
   * this subscriber's `id`.
   *
   * @param {string[]} names Method names to create channels for.
   * @returns {TracingChannel[]} The constructed tracing channels.
   */
  buildChannels(names) {
    return names.map((name) => tracingChannel(`${this.id}:${name}`))
  }

  /**
   * Creates a new segment, starts its timer, and returns an updated context
   * that has entered the new segment. Returns the original context unchanged
   * when the tracer cannot create the segment.
   *
   * @param {object} params Parameters for segment creation.
   * @param {string} params.name Name of the segment to create.
   * @param {Function} [params.recorder] Optional metric recorder for the segment.
   * @param {object} params.ctx The current async context containing the parent
   * segment and active transaction.
   * @returns {object} The updated context with the new segment, or the original
   * context if segment creation failed.
   */
  createSegment({ name, recorder, ctx }) {
    const parent = ctx.segment

    const segment = this.agent.tracer.createSegment({
      name,
      parent,
      recorder,
      transaction: ctx.transaction
    })

    if (segment) {
      segment.start()
      return ctx.enterSegment({ segment })
    }
    return ctx
  }

  /**
   * Default `start` event handler. Creates a segment named after `data.name`.
   * Subclasses may override this to customize segment creation or add
   * attributes.
   *
   * @param {object} data Event data published to the tracing channel's `start` event.
   * @param {string} data.name Name to use for the created segment.
   * @param {object} ctx The current async context.
   * @returns {object} The updated context returned by {@link #createSegment}.
   */
  handler(data, ctx) {
    return this.createSegment({ name: data.name, ctx })
  }

  /**
   * Handler for the tracing channel `end` event. Touches the active segment
   * to record that the synchronous portion of the call has completed.
   *
   * @param {object} data Event data published to the `end` event.
   */
  end(data) {
    const ctx = this.agent.tracer.getContext()
    ctx?.segment?.touch()
  }

  /**
   * Handler for the tracing channel `asyncEnd` event. Touches the segment for
   * this call to stop its timer once the async operation has resolved.
   *
   * We cannot rely on the context manager to obtain the segment here. By the
   * time the callback runs, the active context is whatever was captured when
   * the underlying async resource was created -- which may belong to another
   * instrumented function called from inside this one (e.g. `child_process.exec`
   * creating its child process inside an instrumented `execFile`). The segment
   * stashed on the event data in `enable` is the correct one.
   *
   * @param {object} data Event data published to the `asyncEnd` event.
   */
  asyncEnd(data) {
    if (this.hasCallback) {
      data?.segment?.touch()
      return
    }

    const ctx = this.agent.tracer.getContext()
    ctx?.segment?.touch()
  }

  /**
   * Instruments the resolved core module. Must be implemented by every
   * subclass.
   *
   * @param {object} pkg The resolved core module (e.g. the return value of
   * `require('dns')`).
   * @throws {Error} Always — subclasses must provide their own implementation.
   */
  instrument(pkg) {
    throw new Error('Must implement instrument for your given subscriber')
  }

  /**
   * Activates the subscriber by:
   * 1. Calling {@link #instrument} with the required package.
   * 2. Binding the async-local-storage store to each channel's `start` event
   *    so that a new segment is created whenever a tracked method is called
   *    inside an active transaction.
   * Any error thrown by {@link #instrument} is caught and logged as a warning
   * rather than propagated to the caller.
   *
   */
  enable() {
    try {
      this.instrument(require(this.packageName))
    } catch (error) {
      this.logger.warn(error, 'Failed to instrument %s', this.packageName)
      return
    }

    for (const channel of this.channels) {
      channel.start.bindStore(this.store, (data) => {
        const ctx = this.agent.tracer.getContext()
        if (!ctx?.transaction?.isActive()) {
          this.logger.trace('Not recording event for %s, transaction is not active', this.packageName)
          return ctx
        }

        const result = this.handler(data, ctx)
        if (this.hasCallback) {
          data.segment = result?.segment
        }
        return result
      })
    }
  }

  /**
   * Subscribes the pre-bound `handlers` to every channel's tracing events.
   * Must be called after {@link #enable} so that context is propagated
   * correctly when the handlers run.
   */
  subscribe() {
    for (const channel of this.channels) {
      channel.subscribe(this.handlers)
    }
  }

  /**
   * Unsubscribes the `handlers` from every channel's tracing events.
   */
  unsubscribe() {
    for (const channel of this.channels) {
      channel.unsubscribe(this.handlers)
    }
  }

  /**
   * Deactivates the subscriber by unbinding the async-local-storage store
   * from the `start` and `asyncStart` events on all channels.
   */
  disable() {
    for (const channel of this.channels) {
      channel.start.unbindStore(this.store)
      channel.asyncStart.unbindStore(this.store)
    }
  }
}

module.exports = BaseCoreSubscriber
