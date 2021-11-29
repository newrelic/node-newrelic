/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { grabLastUrlSegment } = require('./util')

const SEND_COMMANDS = ['SendMessageCommand', 'SendMessageBatchCommand']

const RECEIVE_COMMANDS = ['ReceiveMessageCommand']

module.exports = function instrument(shim, name, resolvedName) {
  const fileNameIndex = resolvedName.indexOf('/index')
  const relativeFolder = resolvedName.substr(0, fileNameIndex)

  // The path changes depending on the version...
  // so we don't want to hard-code the relative
  // path from the module root.
  const sqsClientExport = shim.require(`${relativeFolder}/SQSClient`)

  if (!shim.isFunction(sqsClientExport.SQSClient)) {
    shim.logger.debug('Could not find SQSClient, not instrumenting.')
  } else {
    shim.setLibrary(shim.SQS)
    shim.wrapReturn(
      sqsClientExport,
      'SQSClient',
      function wrappedReturn(shim, fn, fnName, instance) {
        postClientConstructor.call(instance, shim)
      }
    )
  }
}

/**
 * Calls the instances middlewareStack.use to register
 * a plugin that adds a middleware to record the time it teakes to publish a message
 * see: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
 *
 * @param {Shim} shim
 */
function postClientConstructor(shim) {
  this.middlewareStack.use(getPlugin(shim))
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
  const [
    {
      input: { QueueUrl }
    }
  ] = args
  return {
    callback: shim.LAST,
    destinationName: grabLastUrlSegment(QueueUrl),
    destinationType: shim.QUEUE,
    opaque: true
  }
}
