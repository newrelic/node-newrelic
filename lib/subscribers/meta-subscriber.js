/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')

/**
 * @typedef {object} MetaSubscriberParams
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {string} packageName The package name being instrumented.
 * This is what a developer would provide to the `require` function.
 * @property {string} channelName A unique name for the diagnostics channel
 * that will be created and monitored.
 * @property {string[]} channels list of channels to construct new subscribers
 * @property {string[]} events list of events to subscribe to new subscribers
 * @property {number} [callback=null] if consumer is callback based, indicates index of callback
 */

/**
 * Used to subscribe to many different events that have the same behavior around
 * segment creation.
 *
 * @example - ./amqplib/channel-model.js
 */
class MetaSubscriber {
  /**
   * @param {MetaSubscriberParams} params constructor params
   */
  constructor({ agent, logger, packageName, channelName, channels, events, callback = null }) {
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

  get enabled() {
    return this.config.instrumentation[this.packageName].enabled === true
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
