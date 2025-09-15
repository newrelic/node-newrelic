/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')

class MetaSubscriber {
  constructor({ agent, logger, packageName, channelName, channels, events, callback }) {
    this.config = agent.config
    this.packageName = packageName
    this.id = `orchestrion:${packageName}:${channelName}`
    this.subscribers = channels.map((name) => {
      const subscriber = new Subscriber({ agent, logger, packageName, channelName: name })
      subscriber.events = events
      subscriber.handler = this.handler.bind(subscriber)
      if (callback !== null) {
        subscriber.callback = callback
      }
      return subscriber
    })
  }

  enabled() {
    return this.config[this.packageName].enabled === true
  }

  enable() {
    for (const subscriber of this.subscribers) {
      subscriber.enable()
    }
  }

  disable() {
    for (const subscriber of this.subscribers) {
      subscriber.disable()
    }
  }

  subscribe() {
    for (const subscriber of this.subscribers) {
      subscriber.subscribe()
    }
  }

  unsubscribe() {
    for (const subscriber of this.subscribers) {
      subscriber.unsubscribe()
    }
  }
}

module.exports = MetaSubscriber
