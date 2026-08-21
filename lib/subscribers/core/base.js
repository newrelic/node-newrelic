/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

class BaseCoreSubscriber {
  constructor({ agent, logger, packageName, instrumentedMethods = [], hasCallback = false, prefix }) {
    this.agent = agent
    this.config = agent.config
    this.logger = logger.child({ component: `${packageName}-subscriber` })
    this.instrumentedMethods = instrumentedMethods
    this.packageName = packageName
    this.hasCallback = hasCallback
    this.prefix = prefix ? `nr:${prefix}` : 'nr'
    this.channels = this.buildChannels()
    this.store = agent.tracer._contextManager._asyncLocalStorage
    this.handlers = {
      asyncEnd: this.asyncEnd.bind(this)
    }

    if (hasCallback) {
      this.handlers.end = this.end.bind(this)
    }
  }

  buildChannels() {
    return this.instrumentedMethods.map((method) => tracingChannel(`${this.prefix}:${this.packageName}:${method}`))
  }

  get enabled() {
    return this.config.instrumentation[this.packageName].enabled === true
  }

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

  handler(data, ctx) {
    return this.createSegment({ name: data.name, ctx })
  }

  end(data) {
    const ctx = this.agent.tracer.getContext()
    ctx?.segment?.touch()
  }

  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    ctx?.segment?.touch()
  }

  enable() {
    for (const channel of this.channels) {
      channel.start.bindStore(this.store, (data) => {
        const ctx = this.agent.tracer.getContext()
        if (!ctx?.transaction?.isActive()) {
          this.logger.trace('Not recording event for %s, transaction is not active', this.packageName)
          return ctx
        }

        // TODO: do we have to register subscriber tracking metrics like 3rd party?
        return this.handler(data, ctx)
      })

      if (this.hasCallback === true) {
        this.handleCallback(channel)
      }
    }
  }

  subscribe() {
    for (const channel of this.channels) {
      channel.subscribe(this.handlers)
    }
  }

  unsubscribe() {
    for (const channel of this.channels) {
      channel.unsubscribe(this.handlers)
    }
  }

  disable() {
    for (const channel of this.channels) {
      channel.start.unbindStore(this.store)
      channel.asyncStart.unbindStore(this.store)
    }
  }

  handleCallback(channel) {
    channel.asyncStart.bindStore(this.store, (data) => {
      const name = `Callback: ${data.callbackName}`
      const ctx = this.agent.tracer.getContext()
      if (!ctx?.transaction?.isActive()) {
        this.logger.trace('Not recording callback segment %s for %s, transaction is not active', name, this.packageName)
        return ctx
      }

      const newCtx = this.createSegment({ name, ctx })
      return newCtx
    })
  }
}

module.exports = BaseCoreSubscriber
