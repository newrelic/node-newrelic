/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')

class MessageProducerSubscriber extends Subscriber {
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
    this.insertDTHeaders({ ctx: newCtx, headers: this.headers })
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
