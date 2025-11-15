/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Subscriber = require('../base')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')
const { getParametersFromMessage, EXCHANGE_PREFIX } = require('./utils')

class GetMessageSubscriber extends Subscriber {
  constructor({ agent, logger, channelName = 'nr_get' }) {
    super({ agent, logger, packageName: 'amqplib', channelName })
    this.events = ['asyncEnd']
  }

  handler(data, ctx) {
    const queue = this.extractQueue(data.arguments)
    const name = `${EXCHANGE_PREFIX}/Consume/${queue}`
    return this.createSegment({
      name,
      ctx,
      recorder: genericRecorder
    })
  }

  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    const segment = ctx?.segment
    const { result: message } = data
    if (!(message?.fields || message?.properties) || !segment) {
      this.logger.trace('No message from consume, not capturing segment parameters')
      super.asyncEnd(data)
      return
    }

    const params = getParametersFromMessage.call(this, { message, channel: data?.self })
    for (const [key, value] of Object.entries(params)) {
      segment.addAttribute(key, value)
    }

    super.asyncEnd(data)
  }

  extractQueue(args) {
    const [queue] = args
    return `Named/${queue}`
  }
}

module.exports = GetMessageSubscriber
