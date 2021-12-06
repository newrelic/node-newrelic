/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { getExport, wrapPostClientConstructor, wrapReturn } = require('./util')

const postClientConstructor = wrapPostClientConstructor(getPlugin)
const wrappedReturn = wrapReturn(postClientConstructor)

module.exports = function instrument(shim, name, resolvedName) {
  const snsClientExport = getExport(shim, resolvedName, 'SNSClient')

  if (!shim.isFunction(snsClientExport.SNSClient)) {
    shim.logger.debug('Could not find SNSClient, not instrumenting.')
  } else {
    shim.setLibrary(shim.SNS)
    shim.wrapReturn(snsClientExport, 'SNSClient', wrappedReturn)
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
      clientStack.add(snsMiddleware.bind(null, shim), {
        name: 'NewRelicSnsMiddleware',
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
function snsMiddleware(shim, next, context) {
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
