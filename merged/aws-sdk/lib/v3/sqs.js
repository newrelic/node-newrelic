/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { grabLastUrlSegment } = require('../util')

const { getExport, wrapPostClientConstructor, wrapReturn } = require('./util')

const SEND_COMMANDS = ['SendMessageCommand', 'SendMessageBatchCommand']

const RECEIVE_COMMANDS = ['ReceiveMessageCommand']

const postClientConstructor = wrapPostClientConstructor(getPlugin)
const wrappedReturn = wrapReturn(postClientConstructor)

module.exports = function instrument(shim, name, resolvedName) {
  const sqsClientExport = getExport(shim, resolvedName, 'SQSClient')

  if (!shim.isFunction(sqsClientExport.SQSClient)) {
    shim.logger.debug('Could not find SQSClient, not instrumenting.')
  } else {
    shim.setLibrary(shim.SQS)
    shim.wrapReturn(sqsClientExport, 'SQSClient', wrappedReturn)
  }
}

/**
 * Returns the plugin object that adds middleware
 *
 * @param {Shim} shim
 * @returns {object}
 */
function getPlugin(shim) {
  return {
    applyToStack: (clientStack) => {
      clientStack.add(sqsMiddleware.bind(null, shim), {
        name: 'NewRelicSqsMiddleware',
        step: 'initialize',
        priority: 'high'
      })
    }
  }
}

/**
 * Middleware hook that records the middleware chain
 * when command is `PublishCommand`
 *
 * @param {Shim} shim
 * @param {function} next middleware function
 * @param {Object} context
 * @returns {function}
 */
function sqsMiddleware(shim, next, context) {
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
