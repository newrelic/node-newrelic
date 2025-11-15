/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')

/**
 * @typedef {object} MessageProducerParams
 * @property {object} agent A New Relic Node.js agent instance.
 * @property {object} logger An agent logger instance.
 * @property {string} packageName The package name being instrumented.
 * This is what a developer would provide to the `require` function.
 * @property {string} channelName A unique name for the diagnostics channel
 * that will be created and monitored.
 * @property {string} system canonical mapping of system(i.e. - Kafka, RabbitMq, SNS, SQS)
 * @property {string} type destinationType: Exchange, Queue, Topic
 */

/**
 * Creates the segment for a message producer call. Injects appropriate DT/CAT
 * headers if enabled.
 */
class MessageProducerSubscriber extends Subscriber {
  /**
   * @param {MessageProducerParams} params constructor params
   */
  constructor({ agent, logger, packageName, channelName, system, type }) {
    super({ agent, logger, packageName, channelName })
    this.system = system
    this.prefix = 'MessageBroker'
    this.type = type
  }

  handler(data, ctx) {
    const newCtx = this.createSegment({
      name: this.name,
      ctx,
      recorder: genericRecorder
    })
    this.insertDTHeaders({ ctx: newCtx, headers: this.headers, useMqNames: true })
    return newCtx
  }

  get name() {
    let name = `${this.prefix}/${this.system}/${this.type}/Produce`
    if (this.destination) {
      name += `/Named/${this.destination}`
    } else {
      name += '/Temp'
    }
    return name
  }

  addAttributes(segment) {
    for (const [key, value] of Object.entries(this.parameters)) {
      segment.addAttribute(key, value)
    }
  }
}

module.exports = MessageProducerSubscriber
