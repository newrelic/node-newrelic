/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { grabLastUrlSegment } = require('../util')

const SEND_COMMANDS = ['SendMessageCommand', 'SendMessageBatchCommand']

const RECEIVE_COMMANDS = ['ReceiveMessageCommand']
const { MessageSpec } = require('../../../shim/specs')
const InstrumentationDescriptor = require('../../../instrumentation-descriptor')

/**
 * Middleware hook that records the middleware chain
 * when command is `PublishCommand`
 *
 * @param {Shim} shim
 * @param config
 * @param {function} next middleware function
 * @param {Object} context
 * @returns {function}
 */
function sqsMiddleware(shim, config, next, context) {
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
 * @param name
 * @param {Array} args to the middleware function
 * @returns {Object}
 */
function getSqsSpec(shim, original, name, args) {
  const [command] = args
  const { QueueUrl } = command.input
  return new MessageSpec({
    callback: shim.LAST,
    destinationName: grabLastUrlSegment(QueueUrl),
    destinationType: shim.QUEUE,
    opaque: true
  })
}

module.exports.sqsMiddlewareConfig = {
  middleware: sqsMiddleware,
  init(shim) {
    shim.setLibrary(shim.SQS)
    return true
  },
  type: InstrumentationDescriptor.TYPE_MESSAGE,
  config: {
    name: 'NewRelicSqsMiddleware',
    step: 'initialize',
    priority: 'high',
    override: true
  }
}
