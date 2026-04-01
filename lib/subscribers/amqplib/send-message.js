/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MessageProducerSubscriber = require('#agentlib/subscribers/message-producer.js')
const {
  DESTINATION_TYPE_EXCHANGE,
  LIB_RABBITMQ
} = require('#agentlib/message-broker-description.js')
const { getParameters, TEMP_RE } = require('./utils')

class ChannelSubscriber extends MessageProducerSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      packageName: 'amqplib',
      channelName: 'nr_sendMessage',
      system: LIB_RABBITMQ,
      type: DESTINATION_TYPE_EXCHANGE
    })
    this.events = ['end']
  }

  handler(data, ctx) {
    const [fields] = data.arguments

    if (!fields) {
      return ctx
    }

    this.destination = this.getExchange(fields)
    this.parameters = this.getParameters({ fields, channel: data.self })
    this.headers = fields?.headers
    return super.handler(data, ctx)
  }

  getParameters({ fields = {}, channel = {} }) {
    const params = {}
    getParameters.call(this, { fields, channel, params })
    return params
  }

  getExchange(fields = {}) {
    const isDefault = fields.exchange === ''
    let exchange = 'Default'
    if (!isDefault) {
      exchange = TEMP_RE.test(fields.exchange) ? null : fields.exchange
    }
    return exchange
  }
}

module.exports = ChannelSubscriber
