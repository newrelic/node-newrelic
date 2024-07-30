/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  MessageSpec,
  params: { QueueMessageParameters }
} = require('../../shim/specs')
const { amqpConnection } = require('../../symbols')
const TEMP_RE = /^amq\./

/**
 * Wrapper around message handler to pass host/port
 *
 * @param {object} params to function
 * @param {string} params.host hostname
 * @param {number} params.port port
 * @returns {function} message handler
 */
function describeMessage({ host, port }) {
  /**
   *  Extracts the appropriate messageHandler parameters for the consume method.
   *
   *  @param {Shim} shim instance of shim
   *  @param {Array} args arguments passed to the consume method
   *  @returns {object} message params
   */
  return function messageHandler(shim, args) {
    const [message] = args

    if (!message?.properties) {
      shim.logger.debug({ message: message }, 'Failed to find message in consume arguments.')
      return null
    }

    const parameters = getParametersFromMessage({ message, host, port })
    let exchangeName = message?.fields?.exchange || 'Default'

    if (TEMP_RE.test(exchangeName)) {
      exchangeName = null
    }

    return new MessageSpec({
      destinationName: exchangeName,
      destinationType: shim.EXCHANGE,
      routingKey: message?.fields?.routingKey,
      headers: message.properties.headers,
      parameters
    })
  }
}

/**
 * Sets the relevant message parameters
 *
 * @param {object} params to function
 * @param {object} params.parameters object used to store the message parameters
 * @param {object} params.fields fields from the sendMessage method
 * @param {string} params.host hostname
 * @param {number} params.port port
 * @returns {QueueMessageParameters} parameters updated parameters
 */
function getParameters({ parameters, fields, host, port }) {
  if (fields.routingKey) {
    parameters.routing_key = fields.routingKey
  }
  if (fields.correlationId) {
    parameters.correlation_id = fields.correlationId
  }
  if (fields.replyTo) {
    parameters.reply_to = fields.replyTo
  }

  if (host) {
    parameters.host = host
  }

  if (port) {
    parameters.port = port
  }

  return new QueueMessageParameters(parameters)
}

/**
 * Sets the QueueMessageParameters from the amqp message
 *
 * @param {object} params to function
 * @param {object} params.message queue message
 * @param {string} params.host host
 * @param {number} params.port port
 * @returns {QueueMessageParameters} parameters from message
 */
function getParametersFromMessage({ message, host, port }) {
  const parameters = Object.create(null)
  getParameters({ parameters, fields: message.fields, host, port })
  getParameters({ parameters, fields: message.properties })
  return parameters
}

/**
 * Extracts the host/port from the amqp socket connection.
 * Stores on connection as symbol to only parse once.
 *
 * @param {Socket} socket amqp connection
 * @returns {object} {host, port } of connection
 */
function parseConnect(socket) {
  if (socket[amqpConnection]) {
    return socket[amqpConnection]
  }
  const host = ['127.0.0.1', '::1', '[::1]'].includes(socket?.remoteAddress)
    ? 'localhost'
    : socket?.remoteAddress
  const port = socket?.remotePort
  socket[amqpConnection] = { host, port }
  return { host, port }
}

/**
 * Helper to set the appropriate value of the callback property
 * in the spec. If it's a promise set to null otherwise set it to `shim.LAST`
 *
 * @param {Shim} shim instance of shim
 * @param {boolean} promiseMode is this promise based?
 * @returns {string|null} appropriate value
 */
function setCallback(shim, promiseMode) {
  return promiseMode ? null : shim.LAST
}

module.exports = {
  describeMessage,
  getParameters,
  getParametersFromMessage,
  parseConnect,
  setCallback,
  TEMP_RE
}
