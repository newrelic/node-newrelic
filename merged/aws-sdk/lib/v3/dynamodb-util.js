/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { setDynamoParameters } = require('../util')

/**
 * Returns the spec for Dynamo commands
 *
 * @param {Shim} shim
 * @param {original} original Original middleware function
 * @param {String} name Name of the calling function
 * @param {Array} args Arguments for the middleware function
 * @returns {Object}
 */
function getDynamoSpec(shim, original, name, args) {
  const [{ input }] = args
  return {
    name: this.commandName,
    parameters: setDynamoParameters(this.endpoint, input),
    callback: shim.LAST,
    opaque: true,
    promise: true
  }
}

/**
 * Middleware hook that records the middleware chain
 * when command is in a list of monitored commands.
 *
 * @param {Shim} shim
 * @param {Object} config AWS SDK client configuration
 * @param {function} next middleware function
 * @param {Object} context Context for the running command
 * @returns {function}
 */
function dynamoMiddleware(shim, config, next, context) {
  const { commandName } = context
  return async function wrappedMiddleware(args) {
    const endpoint = await config.endpoint()
    const getSpec = getDynamoSpec.bind({ endpoint, commandName })
    const wrappedNext = shim.recordOperation(next, getSpec)
    return wrappedNext(args)
  }
}

module.exports = {
  dynamoMiddleware
}
