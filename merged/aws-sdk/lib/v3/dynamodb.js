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
 * AWS sdk v 3.194?.0 released a breaking change.
 * See: https://github.com/aws/aws-sdk-js-v3/issues/4122
 * What this means is config.endpoint is not always a function
 * unless you provide an endpoint override to your library constructor
 * This function will derive the endpoint in that scenario by grabbing the region
 * and building the URL
 */
async function getEndpoint(config) {
  if (typeof config.endpoint === 'function') {
    return await config.endpoint()
  }

  const region = await config.region()
  return new URL(`https://dynamodb.${region}.amazonaws.com`)
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
  shim.setDatastore(shim.DYNAMODB)
  const { commandName } = context
  return async function wrappedMiddleware(args) {
    let endpoint = null
    try {
      endpoint = await getEndpoint(config)
    } catch (err) {
      shim.logger.debug(err, 'Failed to get the endpoint.')
    }

    const getSpec = getDynamoSpec.bind({ endpoint, commandName })
    const wrappedNext = shim.recordOperation(next, getSpec)
    return wrappedNext(args)
  }
}

const dynamoMiddlewareConfig = {
  middleware: dynamoMiddleware,
  type: 'datastore',
  config: {
    name: 'NewRelicDynamoMiddleware',
    step: 'initialize',
    priority: 'high'
  }
}

module.exports = {
  dynamoMiddlewareConfig
}
