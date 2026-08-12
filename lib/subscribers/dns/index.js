/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { INSTRUMENTED_METHODS } = require('./constants')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

class DnsSubscriber {
  constructor({ agent, logger }) {
    this.agent = agent
    this.config = agent.config
    this.logger = logger.child({ component: 'dns-subscriber' })
    this.prefix = 'nr:dns'
    this.channels = this.buildChannels()
    this.store = agent.tracer._contextManager._asyncLocalStorage
    this.boundEnd = this.#end.bind(this)
    this.boundAsyncEnd = this.#asyncEnd.bind(this)
  }

  buildChannels() {
    return INSTRUMENTED_METHODS.map((method) => tracingChannel(`${this.prefix}:${method}`))
  }

  get enabled() {
    return this.config.instrumentation.dns.enabled === true
  }

  createSegment({ name, ctx }) {
    const parent = ctx.segment

    const segment = this.agent.tracer.createSegment({
      name,
      parent,
      transaction: ctx.transaction
    })

    if (segment) {
      segment.start()
      return ctx.enterSegment({ segment })
    }
    return ctx
  }

  enable() {
    for (const channel of this.channels) {
      channel.start.bindStore(this.store, (data) => {
        const ctx = this.agent.tracer.getContext()
        if (!ctx?.transaction?.isActive()) {
          return ctx
        }

        return this.createSegment({ name: data.name, ctx })
      })

      channel.asyncStart.bindStore(this.store, (data) => {
        const ctx = this.agent.tracer.getContext()
        if (!ctx?.transaction?.isActive()) {
          return ctx
        }

        const name = `Callback: ${data.callbackName}`
        const newCtx = this.createSegment({ name, ctx })
        return newCtx
      })
    }
  }

  #end() {
    const ctx = this.agent.tracer.getContext()
    ctx?.segment?.touch()
  }

  #asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    ctx?.segment?.touch()
  }

  subscribe() {
    for (const channel of this.channels) {
      channel.subscribe({ end: this.boundEnd, asyncEnd: this.boundAsyncEnd })
    }
  }

  unsubscribe() {
    for (const channel of this.channels) {
      channel.unsubscribe({ end: this.boundEnd, asyncEnd: this.boundAsyncEnd })
    }
  }

  disable() {
    for (const channel of this.channels) {
      channel.start.unbindStore(this.store)
      channel.asyncStart.unbindStore(this.store)
    }
  }
}

module.exports = DnsSubscriber
