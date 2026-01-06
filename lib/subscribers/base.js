/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')
const cat = require('#agentlib/util/cat.js')
const recordSupportabilityMetric = require('./record-supportability-metric.js')

// Used for the `traceCallback` work.
// This can be removed when we add true support into orchestrion
const makeCall = (fn) => (...args) => fn.call(...args)
const ArrayPrototypeAt = makeCall(Array.prototype.at)
const ArrayPrototypeSplice = makeCall(Array.prototype.splice)
// End temp work

/**
 * The baseline parameters available to all subscribers.
 *
 * @typedef {object} SubscriberParams
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {string} packageName The package name being instrumented.
 * This is what a developer would provide to the `require` function.
 * @property {string} channelName A unique name for the diagnostics channel
 * that will be created and monitored.
 */

/**
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {TracingChannel} channel The tracing channel instance this subscriber will be monitoring.
 * @property {string} channelName A unique name for the diagnostics channel
 * that will be registered.
 * @property {object} config The agent configuration object.
 * @property {string} id A unique identifier for the subscriber, combining the prefix, package
 * name, and channel name.
 * @property {object} logger An agent logger instance.
 * @property {string} packageName The name of the module being instrumented.
 * This is the same string one would pass to the `require` function.
 * @property {AsyncLocalStorage} store The async local storage instance used for context management.
 * @property {number} [callback=null] Position of callback if it needs to be wrapped for instrumentation.
 * -1 means last argument.
 * @property {string[]} [events=[]] Set of tracing channel event names to
 * register handlers for. For any name in the set, a corresponding method
 * must exist on the subscriber instance. The method will be passed the
 * event object. Possible event names are `start`, `end`, `asyncStart`,
 * `asyncEnd`, and `error`.
 * See {@link https://nodejs.org/api/diagnostics_channel.html#class-tracingchannel}
 * @property {boolean} [internal=false] If true, any children segments from the same library
 * will not be created.
 * @property {boolean} [opaque=false] If true, any children segments will not be created.
 * @property {string} [prefix='orchestrion:'] String to prepend to diagnostics
 * channel event names. This provides a namespace for the events we are
 * injecting into a module.
 * @property {boolean} [propagateContext=false] If true, it will bind `asyncStart` to the store
 * and re-propagate the active context. It will also attach the `transaction` to the event in
 * `start.bindStore`. This is used for functions that queue async code and context is lost.
 * @property {boolean} [requireActiveTx=true] If true, the subscriber will only handle events
 * when there is an active transaction.
 * @property {object} [targetModuleMeta] Defines the target module's name and
 * version string, i.e. is an object `{ name, version }`. This is only necessary
 * when target instrumentation can surface an unexpected name for the
 * `packageName` property. For example, `express` uses multiple modules to
 * compose its core functionality. We want to track things under the `express`
 * name, but `packageName` will be set to `router` is most cases.
 */
class Subscriber {
  #usageMetricRecorded = false

  /**
   * @param {SubscriberParams} params the subscriber constructor params
   */
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
    this.propagateContext = false
    this.id = `${this.prefix}${this.packageName}:${this.channelName}`
    this.channel = tracingChannel(this.id)
    this.store = agent.tracer._contextManager._asyncLocalStorage
    this.callback = null
  }

  shouldCreateSegment(parent) {
    return !(parent?.opaque ||
    (this.internal && this.packageName === parent?.shimId)
    )
  }

  /**
   * Note: This is a temporary patch until we can get the correct implementation
   * of `tracingChannel.traceCallback` into orchestrion-js.
   *
   * This will wrap a callback at a given position and reassign the callback argument to the wrapped one
   *
   * @param {number} position index of the callback, you can specify -1 to be the last
   * @param {object} context the event passed to the tracing channel hooks
   */
  traceCallback(position, context) {
    this.logger.trace('Wrapping the callback at position %s', position)
    const { asyncStart, asyncEnd, error } = this.channel
    function wrappedCallback(err, res) {
      // assigning a boolean to the context so we know that the
      // `error`, `asyncStart`, and `asyncEnd` are coming from the wrapped callback
      context.callback = true
      if (err) {
        context.error = err
        error.publish(context)
      } else {
        context.result = res
      }

      // Using runStores here enables manual context failure recovery
      asyncStart.runStores(context, () => {
        try {
          if (callback) {
            const cbResult = Reflect.apply(callback, this, arguments)
            context.cbResult = cbResult
            return cbResult
          }
        } finally {
          asyncEnd.publish(context)
        }
      })
    }

    const callback = ArrayPrototypeAt(context.arguments, position)
    if (typeof callback !== 'function') {
      this.logger.trace('Callback is not present, not wrapping')
    } else {
      ArrayPrototypeSplice(context.arguments, position, 1, wrappedCallback)
    }
  }

  /**
   * Wraps an event emitter and runs the wrap in the new context
   * If the event is `end` or `error`, it'll touch the active segment.
   *
   * @param {object} params to function
   * @param {Array} params.args arguments to function
   * @param {number} params.index index of argument to wrap
   * @param {string} [params.name] name of emit function, defaults to 'emit'
   * @param {Context} params.ctx context to bind wrapped emit to
   */
  wrapEventEmitter({ args, index, name = 'emit', ctx }) {
    const orig = args[index][name]
    const self = this
    function wrapEmit(...emitArgs) {
      const ctx = self.agent.tracer.getContext()
      const [evnt] = emitArgs
      if (evnt === 'end' || evnt === 'error') {
        ctx?.segment?.touch()
      }
      return orig.apply(this, emitArgs)
    }
    args[index][name] = this.agent.tracer.bindFunction(wrapEmit, ctx, false)
  }

  /**
   * Creates a segment with a name, parent, transaction and optional recorder.
   * If the segment is successfully created, it will be started and added to the context.
   * @param {object} params - Parameters for creating the segment
   * @param {string} params.name - The name of the segment
   * @param {object} [params.recorder] - Optional recorder for the segment
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
      this.logger.trace('Created segment %s, returning new context', name)
      this.addAttributes(segment)
      const newCtx = ctx.enterSegment({ segment })
      return newCtx
    } else {
      this.logger.trace('Failed to create segment for %s, returning existing context', name)
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
   * Not all subscribers need to change the context on an event.
   * This is defined on base to fulfill those use cases.
   * @param {object} data event passed to handler
   * @param {Context} ctx context passed to handler
   * @returns {Context} either new context or existing
   */
  handler(data, ctx) {
    return ctx
  }

  /**
   * Checks if the subscriber is enabled based on the agent's configuration.
   * @returns {boolean} if subscriber is enabled
   */
  get enabled() {
    return this.config.instrumentation[this.packageName].enabled === true
  }

  /**
   * Enables the subscriber by binding the store to the channel and setting up the handler.
   * If the subscriber requires an active transaction, it will check the context before passing the event to the handler.
   * @returns {void} The `bindStore` function with our handler.
   */
  enable() {
    /**
     * Event handler for processing incoming events.
     * @param {object} data Event data
     * @returns {Context} The context after processing the event
     */
    const handler = (data) => {
      if (this.#usageMetricRecorded === false) {
        recordSupportabilityMetric({
          agent: this.agent,
          moduleName: this.packageName,
          moduleVersion: data.moduleVersion
        })
        this.#usageMetricRecorded = true
      }

      // only wrap the callback if a subscriber has a callback property defined
      if (this.callback !== null) {
        this.traceCallback(this.callback, data)
      }
      const ctx = this.agent.tracer.getContext()
      if (this.requireActiveTx && !ctx?.transaction?.isActive()) {
        this.logger.trace('Not recording event for %s, transaction is not active', this.package)
        return ctx
      }

      const result = this.handler(data, ctx)
      // we cannot rely on the context manager to obtain the active segment
      // in the `asyncStart` and `asyncEnd` events. This is because other instrumented
      // functions are being executed at times. so we assign the active segment on the data
      // so it can be used later to properly touch the segment in `asyncStart` and `asyncEnd`
      if (this.callback !== null) {
        data.segment = result?.segment
        this.logger.trace('Adding segment %s to event context', data?.segment?.name)
      }

      // attach to event as it will be used to re-bind context in `asyncStart.bindStore`
      if (this.propagateContext) {
        data.transaction = result?.transaction
      }
      return result
    }

    this.channel.start.bindStore(this.store, handler)
    if (this.propagateContext) {
      this.channel.asyncStart.bindStore(this.store, (data) => {
        const { transaction, segment } = data
        const ctx = this.agent.tracer.getContext()

        if (!(transaction && segment)) {
          this.logger.trace('No active transaction/segment, returning existing context')
          return ctx
        }
        const newCtx = ctx.enterSegment({ transaction, segment })
        return newCtx
      })
    }
  }

  /**
   * Disables the subscriber by unbinding the store from the channel.
   */
  disable() {
    this.channel.start.unbindStore(this.store)
    if (this.propagateContext) {
      this.channel.asyncStart.unbindStore(this.store)
    }
  }

  /**
   * This should only be used for callback based functions to touch the segment for the function
   * that implements a callback.
   * @param {object} data event passed to asyncStart hook
   */
  asyncStart(data) {
    const ctx = this.agent.tracer.getContext()
    if (data.callback !== true || this.internal === true || (this.requireActiveTx && !ctx?.transaction?.isActive())) {
      this.logger.trace('Not touching parent in asyncStart for %s, transaction is not active? %s, segment is internal? %s, or no callback to bind', this.id, ctx?.transaction?.isActive(), this.internal)
      return
    }

    this.logger.trace('touching segment %s, in asyncStart', data?.segment?.name)
    data?.segment?.touch()
  }

  /**
   * Common handler for when async events end.
   * It gets the context and touches the segment if it exists.
   * @param {object} data event passed to asyncEnd hook
   */
  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    if (this.internal === true) {
      this.logger.trace('asyncEnd occurring for %s internal event, not touching segment', this.id)
      return
    }

    if (data?.callback === true) {
      this.logger.trace('touching callback segment %s, in asyncEnd', data?.segment?.name)
      data?.segment?.touch()
    } else {
      this.logger.trace('touching segment %s, in asyncEnd', ctx?.segment?.name)
      ctx?.segment?.touch()
    }
  }

  end() {
    const ctx = this.agent.tracer.getContext()
    ctx?.segment?.touch()
  }

  /**
   * Handles injecting w3c tracecontext in outgoing headers. If DT is disabled, and CAT is enabled
   * it properly handles CAT.
   *
   * **Note**: This passes in the trace, segment and trace flags manually because this is called in the `start`
   * right before a function is bound to context but segment is created for the function.
   *
   * @param {object} params to function
   * @param {Context} params.ctx current context, not yet bound to context manager
   * @param {object} params.headers headers for outgoing call
   * @param {boolean} params.useMqNames flag to indicate use the MQ specific CAT header names
   * @returns {void}
   */
  insertDTHeaders({ ctx, headers, useMqNames } = {}) {
    const crossAppTracingEnabled = this.config.cross_application_tracer.enabled
    const distributedTracingEnabled = this.config.distributed_tracing.enabled

    if (!distributedTracingEnabled && !crossAppTracingEnabled) {
      this.logger.trace('Distributed Tracing and CAT are both disabled, not adding headers.')
      return
    }

    if (!headers) {
      this.logger.debug('Missing headers object, not adding headers!')
      return
    }

    const tx = ctx?.transaction
    if (!tx?.isActive()) {
      this.logger.trace('No active transaction found, not adding headers.')
      return
    }

    if (distributedTracingEnabled) {
      // we have to pass in traceId, segment id, and hard code traceFlags to 1
      // because we're inserting headers right before the original function is bound.
      const traceFlags = tx.isSampled() === true ? 1 : 0
      tx.insertDistributedTraceHeaders(headers, null, { traceId: tx.traceId, spanId: ctx?.segment?.id, traceFlags })
    } else {
      cat.addCatHeaders(this.config, tx, headers, useMqNames)
    }
  }

  /*
   * Subscribes to the events defined in the `events` array.
   */
  subscribe() {
    this.subscriptions = this.events.reduce((events, curr) => {
      try {
        events[curr] = this[curr].bind(this)
      } catch {
        // This is for development purposes only and meant to provide a better error to debug with.
        // You should not have to listen to the `start` event.
        // The `start` handler is defined in `enable()`.
        throw new Error(`Failed to bind subscriber event '${curr}'. Is there a handler for this event?`)
      }
      return events
    }, {})

    this.channel.subscribe(this.subscriptions)
  }

  /**
   * Unsubscribes from the events defined in the `events` array.
   */
  unsubscribe() {
    this.channel.unsubscribe(this.subscriptions)
    this.subscriptions = null
  }
}

module.exports = Subscriber
