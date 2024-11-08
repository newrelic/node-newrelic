/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { setDynamoParameters } = require('../util')
const { OperationSpec } = require('../../../shim/specs')
const InstrumentationDescriptor = require('../../../instrumentation-descriptor')

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
  return new OperationSpec({
    name: this.commandName,
    parameters: setDynamoParameters(this.endpoint, input),
    callback: shim.LAST,
    opaque: true,
    promise: true
  })
}

/**
 * AWS sdk v 3.194?.0 released a breaking change.
 * See: https://github.com/aws/aws-sdk-js-v3/issues/4122
 * What this means is config.endpoint is not always a function
 * unless you provide an endpoint override to your library constructor
 * This function will derive the endpoint in that scenario by grabbing the region
 * and building the URL
 * @param config
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

/**
 * Wraps the deserialize middleware step to add the
 * cloud.resource_id segment attributes for the AWS command
 *
 * @param {Shim} shim
 * @param {Object} config AWS command configuration
 * @param {function} next next function in middleware chain
 * @returns {function}
 */
function resourceIdMiddlerware(shim, config, next) {
  return async function wrappedResourceIdMiddlerware(args) {
    let region
    try {
      region = await config.region()
      const segment = shim.getSegment()

      const accountId = shim.agent.config.cloud.aws.account_id

      if (accountId) {
        const attributes = segment.getAttributes()
        segment.addAttribute(
          'cloud.resource_id',
          `arn:aws:dynamodb:${region}:${accountId}:table/${attributes.collection}`
        )
      }
    } catch (err) {
      shim.logger.debug(err, 'Failed to add AWS cloud resource id to segment')
    }

    return next(args)
  }
}

const dynamoMiddlewareConfig = [
  {
    middleware: dynamoMiddleware,
    init(shim) {
      shim.setDatastore(shim.DYNAMODB)
      return true
    },
    type: InstrumentationDescriptor.TYPE_DATASTORE,
    config: {
      name: 'NewRelicDynamoMiddleware',
      step: 'initialize',
      priority: 'high',
      override: true
    }
  },
  {
    middleware: resourceIdMiddlerware,
    type: InstrumentationDescriptor.TYPE_GENERIC,
    config: {
      name: 'NewRelicCloudResource',
      step: 'deserialize',
      priority: 'low',
      override: true
    }
  }
]

module.exports = {
  dynamoMiddlewareConfig
}
