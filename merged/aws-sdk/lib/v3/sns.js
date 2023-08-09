/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Middleware hook that records the middleware chain
 * when command is `PublishCommand`
 *
 * @param {Shim} shim
 * @param {function} next middleware function
 * @param {Object} context
 * @returns {function}
 */
function snsMiddleware(shim, config, next, context) {
  shim.setLibrary(shim.SNS)
  if (context.commandName === 'PublishCommand') {
    return shim.recordProduce(next, getSnsSpec)
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
function getSnsSpec(shim, original, name, args) {
  const [command] = args
  return {
    promise: true,
    callback: shim.LAST,
    destinationName: getDestinationName(command.input),
    destinationType: shim.TOPIC,
    opaque: true
  }
}

/**
 * Helper to set the appropriate destinationName based on
 * the command input
 *
 * @param {Object}
 */
function getDestinationName({ TopicArn, TargetArn }) {
  return TopicArn || TargetArn || 'PhoneNumber' // We don't want the value of PhoneNumber
}

module.exports.snsMiddlewareConfig = {
  middleware: snsMiddleware,
  type: 'message',
  config: {
    name: 'NewRelicSnsMiddleware',
    step: 'initialize',
    priority: 'high'
  }
}
