/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')
const logger = require('../logger').child({ component: 'subscriber' })

class Subscriber {
  constructor(agent, id) {
    this._agent = agent
    this.config = agent.config
    this.id = id
    this._prefix = 'orchestrion:'
    this._channel = tracingChannel(`${this._prefix}${this.id}`)
    this._store = agent.tracer._contextManager._asyncLocalStorage
  }

  set id(id) {
    this._id = id
  }

  get id() {
    return this._id
  }

  set events(events) {
    this._events = events
  }

  get events() {
    return this._events
  }

  get enabled() {
    return true
  }

  set subscriptions(subscriptions) {
    this._subscriptions = subscriptions
  }

  get subscriptions() {
    return this._subscriptions
  }

  enable() {
    this._channel.start.bindStore(this._store, (data) => {
      const ctx = this._agent.tracer.getContext()
      if (this.requireActiveTx && !ctx?.transaction?.isActive()) {
        logger.debug('Not recording event for %s, transaction is not active', this.id)
        return
      }

      return this.handler(data, ctx)
    })
  }

  disable() {
    this._channel.start.unbindStore(this._store)
  }

  asyncEnd() {
    const ctx = this._agent.tracer.getContext()
    ctx?.segment?.end()
  }

  subscribe() {
    this.subscriptions = this.events.reduce((events, curr) => {
      events[curr] = this[curr].bind(this)
      return events
    }, {})

    this._channel.subscribe(this.subscriptions)
  }

  unsubscribe() {
    this._channel.unsubscribe(this.subscriptions)
  }
}

module.exports = Subscriber
