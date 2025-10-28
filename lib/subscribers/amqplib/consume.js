/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MessageConsumerSubscriber = require('../message-consumer')
const { getParameters, getParametersFromMessage, TEMP_RE } = require('./utils')

class ConsumeSubscriber extends MessageConsumerSubscriber {
  constructor({ agent, logger, channelName = 'nr_consume' }) {
    super({ agent, logger, packageName: 'amqplib', channelName, system: 'RabbitMQ', type: 'Exchange', callback: 1, transport: 'AMQP' })
    this.segmentName = 'amqplib.Channel#consume'
  }

  /**
   * Handles the consumption of a message(s),
   * this will create a new transaction every time this function is called.
   * @param {object} data the data associated with the `asyncStart` event
   */
  asyncStart(data) {
    const [queue] = data?.arguments
    const message = data?.error
    this.consumerParameters = getParametersFromMessage.call(this, { channel: data?.self, message })
    this.headers = message?.properties?.headers
    this.destination = this.getExchange(message?.fields)
    this.queue = queue

    super.asyncStart(data)
  }

  getExchange(fields = {}) {
    const isDefault = fields.exchange === ''
    let exchange = 'Default'
    if (!isDefault) {
      exchange = TEMP_RE.test(fields.exchange) ? null : fields.exchange
    }

    return exchange
  }

  /**
   * Handles the creation of the segment if `channel.consume` is made within
   * an active transaction.
   * @param {object} data the data associated with the subscribed event
   * @param {object} ctx context
   */
  handler(data, ctx) {
    this.parameters = {}
    getParameters.call(this, { params: this.parameters, channel: data.self })
    return super.handler(data, ctx)
  }
}

module.exports = ConsumeSubscriber
