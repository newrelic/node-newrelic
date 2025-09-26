/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { amqpConnection } = require('#agentlib/symbols.js')

const TEMP_RE = /^amq\./
const RMQ_PREFIX = 'MessageBroker/RabbitMQ'
const EXCHANGE_PREFIX = `${RMQ_PREFIX}/Exchange`
const QUEUE_PREFIX = `${RMQ_PREFIX}/Queue`

function getParametersFromMessage({ message, channel }) {
  const params = {}
  getParameters.call(this, { channel, fields: message.fields, params })
  getParameters.call(this, { channel, fields: message.properties, params })
  return params
}

function getParameters({ fields = {}, channel = {}, params }) {
  if (this.config.message_tracer.segment_parameters.enabled === false) {
    this.logger.trace('Not capturing segment parameters, `message_tracer.segments_parameters.enabled` is false')
    return
  }

  const { host, port } = channel?.connection?.[amqpConnection]

  if (fields.routingKey) {
    params.routing_key = fields.routingKey
  }
  if (fields.correlationId) {
    params.correlation_id = fields.correlationId
  }
  if (fields.replyTo) {
    params.reply_to = fields.replyTo
  }
  if (host) {
    params.host = host
  }

  if (port) {
    params.port = port
  }
}

module.exports = {
  getParameters,
  getParametersFromMessage,
  EXCHANGE_PREFIX,
  QUEUE_PREFIX,
  TEMP_RE
}
