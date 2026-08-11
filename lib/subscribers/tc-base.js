/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

/**
 * Base class for subscribers whose `tracingChannel` is self-created (via
 * `tracingChannel(id)`) but published by our own monkeypatch rather than by
 * Orchestrion's `ModulePatch` e.g. core Node modules where the target
 * method can be patched directly.
 *
 * Subclasses are responsible for actually publishing to `this.channel`
 * (typically from an overridden `enable()`, guarded so the patch only ever
 * happens once) and for the `handleStart`/`handleAsyncStart` overrides below.
 */
class TcBaseSubscriber {
  constructor({ agent, logger, packageName, channelName }) {
    this.agent = agent
    this.logger = logger.child({ component: `${packageName}-subscriber` })
    this.config = agent.config
    this.packageName = packageName
    this.channelName = channelName
    this.id = `${packageName}.${channelName}`
    this.channel = tracingChannel(this.id)
    this.tracer = agent.tracer
    this.store = agent.tracer._contextManager._asyncLocalStorage
    this._onEnd = this.onEnd.bind(this)
    this._onAsyncEnd = this.onAsyncEnd.bind(this)
  }

  /**
   * Checks if the subscriber is enabled based on the agent's configuration.
   * @returns {boolean} if subscriber is enabled
   */
  get enabled() {
    return this.config.instrumentation[this.packageName].enabled === true
  }

  /**
   * Creates and starts a segment as a child of the given context's segment.
   * @param {Context} ctx active context
   * @param {string} name segment name
   * @returns {TraceSegment|null} the created segment, or null if none was created
   */
  createSegment(ctx, name) {
    const segment = this.tracer.createSegment({ name, parent: ctx?.segment, transaction: ctx?.transaction })
    if (segment) {
      segment.start()
    }
    return segment
  }

  /**
   * Override point: called on `channel.start`. Return the context that
   * should become active for the duration of the traced call.
   * @param {object} data event data published on `channel.start`
   * @param {Context} ctx ambient context at the time `start` fired
   * @returns {Context} context to enter
   */
  handleStart(data, ctx) {
    return ctx
  }

  /**
   * Override point: called on `channel.asyncStart` (i.e. right before a
   * traced callback runs). Return the context that should become active for
   * the duration of the callback.
   * @param {object} data event data published on `channel.start`/`asyncStart`
   * @param {Context} ctx context that was entered on `start` (`data.ctx`)
   * @returns {Context} context to enter
   */
  handleAsyncStart(data, ctx) {
    return ctx
  }

  /**
   * Default `end` handler -- touches whatever segment `handleStart` entered.
   * @param {object} data event data
   */
  onEnd(data) {
    data.ctx?.segment?.touch()
  }

  /**
   * Default `asyncEnd` handler -- touches whatever segment
   * `handleAsyncStart` created, if any.
   * @param {object} data event data
   */
  onAsyncEnd(data) {
    data.callbackSegment?.touch()
  }

  /**
   * Binds this subscriber's store to `channel.start`/`asyncStart` so
   * `handleStart`/`handleAsyncStart` run scoped to the traced call/callback.
   */
  enable() {
    this.channel.start.bindStore(this.store, (data) => {
      data.ctx = this.handleStart(data, this.tracer.getContext())
      return data.ctx
    })
    this.channel.asyncStart.bindStore(this.store, (data) => this.handleAsyncStart(data, data.ctx))
  }

  /**
   * Unbinds this subscriber's store from `channel.start`/`asyncStart`.
   */
  disable() {
    this.channel.start.unbindStore(this.store)
    this.channel.asyncStart.unbindStore(this.store)
  }

  /**
   * Subscribes the default `end`/`asyncEnd` touch handlers.
   */
  subscribe() {
    this.channel.subscribe({ end: this._onEnd, asyncEnd: this._onAsyncEnd })
  }

  /**
   * Unsubscribes the `end`/`asyncEnd` touch handlers.
   */
  unsubscribe() {
    this.channel.unsubscribe({ end: this._onEnd, asyncEnd: this._onAsyncEnd })
  }
}

module.exports = TcBaseSubscriber
