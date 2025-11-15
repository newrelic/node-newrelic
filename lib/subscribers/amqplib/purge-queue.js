/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Subscriber = require('../base')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')
const { TEMP_RE, QUEUE_PREFIX } = require('./utils')

class PurgeQueueSubscriber extends Subscriber {
  constructor({ agent, logger, channelName = 'nr_purgeQueue' }) {
    super({ agent, logger, packageName: 'amqplib', channelName })
    this.events = ['asyncEnd']
  }

  handler(data, ctx) {
    const queue = this.extractQueue(data.arguments)
    const name = `${QUEUE_PREFIX}/Purge/${queue}`
    return this.createSegment({
      name,
      ctx,
      recorder: genericRecorder
    })
  }

  extractQueue(args) {
    let [queue] = args

    if (TEMP_RE.test(queue)) {
      queue = null
    }

    return queue ? `Named/${queue}` : 'Temp'
  }
}

module.exports = PurgeQueueSubscriber
