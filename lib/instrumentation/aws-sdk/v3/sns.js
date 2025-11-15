/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { MessageSpec } = require('../../../shim/specs')
const InstrumentationDescriptor = require('../../../instrumentation-descriptor')

/**
 * Middleware hook that records the middleware chain
 * when command is `PublishCommand`
 *
 * @param {Shim} shim instance
 * @param {object} config configuration options
 * @param {Function} next middleware function
 * @param {object} context context
 * @returns {Function}
 */
function snsMiddleware(shim, config, next, context) {
  if (context.commandName === 'PublishCommand') {
    return shim.recordProduce(next, getSnsSpec)
  }
  shim.logger.debug(`Not instrumenting command ${context.commandName}.`)

  return next
}

/**
 * Returns the spec for PublishCommand
 *
 * @param {Shim} shim instance
 * @param {Function} original original middleware function
 * @param {string} name function name
 * @param {Array} args to the middleware function
 * @returns {object}
 */
function getSnsSpec(shim, original, name, args) {
  const [command] = args
  return new MessageSpec({
    promise: true,
    callback: shim.LAST,
    destinationName: getDestinationName(command.input),
    destinationType: shim.TOPIC,
    opaque: true
  })
}

/**
 * Helper to set the appropriate destinationName based on
 * the command input
 *
 * @param {object} params params object
 * @param {string} params.TopicArn TopicArn if available
 * @param {string} params.TargetArn TargetArn if available
 */
function getDestinationName({ TopicArn, TargetArn }) {
  return TopicArn || TargetArn || 'PhoneNumber' // We don't want the value of PhoneNumber
}

module.exports.snsMiddlewareConfig = {
  middleware: snsMiddleware,
  init(shim) {
    shim.setLibrary(shim.SNS)
    return true
  },
  type: InstrumentationDescriptor.TYPE_MESSAGE,
  config: {
    name: 'NewRelicSnsMiddleware',
    step: 'initialize',
    priority: 'high',
    override: true
  }
}
