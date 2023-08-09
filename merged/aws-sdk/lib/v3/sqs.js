/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { grabLastUrlSegment } = require('../util')

const SEND_COMMANDS = ['SendMessageCommand', 'SendMessageBatchCommand']

const RECEIVE_COMMANDS = ['ReceiveMessageCommand']

/**
 * Middleware hook that records the middleware chain
 * when command is `PublishCommand`
 *
 * @param {Shim} shim
 * @param {function} next middleware function
 * @param {Object} context
 * @returns {function}
 */
function sqsMiddleware(shim, config, next, context) {
  shim.setLibrary(shim.SQS)
  if (SEND_COMMANDS.includes(context.commandName)) {
    return shim.recordProduce(next, getSqsSpec)
  } else if (RECEIVE_COMMANDS.includes(context.commandName)) {
    return shim.recordConsume(next, getSqsSpec)
  }
  shim.logger.debug(`Not instrumenting command ${context.commandName}.`)

  return next
}

/**
 * Returns the spec for PublishCommand
 *
 * @param {Shim} shim
 * @param {original} original original middleware function
 * @param {Array} args to the middleware function
 * @returns {Object}
 */
function getSqsSpec(shim, original, name, args) {
  const [command] = args
  const { QueueUrl } = command.input
  return {
    callback: shim.LAST,
    destinationName: grabLastUrlSegment(QueueUrl),
    destinationType: shim.QUEUE,
    opaque: true
  }
}

module.exports.sqsMiddlewareConfig = {
  middleware: sqsMiddleware,
  type: 'message',
  config: {
    name: 'NewRelicSnsMiddleware',
    step: 'initialize',
    priority: 'high'
  }
}
