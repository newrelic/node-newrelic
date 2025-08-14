/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

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
