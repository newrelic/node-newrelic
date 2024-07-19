/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const UNKNOWN = 'Unknown'
const InstrumentationDescriptor = require('../../../instrumentation-descriptor')

/**
 * Wraps the build middleware step to add the disable DT
 * header to all outgoing requests
 *
 * @param {Shim} shim
 * @param config
 * @param {function} next next function in middleware chain
 * @returns {function}
 *
 */
function headerMiddleware(shim, config, next) {
  return async function wrappedHeaderMw(args) {
    // this is an indicator in the agent http-outbound instrumentation
    // to disable DT from AWS requests as they are not necessary
    args.request.headers['x-new-relic-disable-dt'] = 'true'
    return await next(args)
  }
}

/**
 * Wraps the deserialize middleware step to add the
 * appropriate segment attributes for the AWS command
 *
 * @param {Shim} shim
 * @param {Object} config AWS command configuration
 * @param {function} next next function in middleware chain
 * @param {Object} contxt AWS command context
 * cons
 * @param context
 * @returns {function}
 */
function attrMiddleware(shim, config, next, context) {
  return async function wrappedMiddleware(args) {
    let region
    try {
      region = await config.region()
    } catch (err) {
      shim.logger.debug(err, 'Failed to get the AWS region')
    } finally {
      const result = await next(args)
      addAwsAttributes({ result, config, region, shim, context })
      return result
    }
  }
}

/**
 * Adds the necessary aws.* attributes to either the External or first
 * class operation segment
 *
 * @param {Object} params
 * @param {Object} params.result result from middleware
 * @param {Object} params.config AWS config
 * @param {string} params.region AWS region
 * @param {Shim} params.shim
 * @param {Object} params.context smithy client context
 */
function addAwsAttributes({ result, config, region, shim, context }) {
  try {
    const { response } = result
    const segment = shim.getSegment(response.body.req)
    segment.addAttribute('aws.operation', context.commandName || UNKNOWN)
    segment.addAttribute('aws.requestId', response.headers['x-amzn-requestid'] || UNKNOWN)
    segment.addAttribute('aws.service', config.serviceId || UNKNOWN)
    segment.addAttribute('aws.region', region || UNKNOWN)
  } catch (err) {
    shim.logger.debug(err, 'Failed to add AWS attributes to segment')
  }
}

module.exports.middlewareConfig = [
  {
    middleware: headerMiddleware,
    type: InstrumentationDescriptor.TYPE_GENERIC,
    config: {
      name: 'NewRelicHeader',
      step: 'finalizeRequest',
      priority: 'low',
      override: true
    }
  },
  {
    middleware: attrMiddleware,
    type: InstrumentationDescriptor.TYPE_GENERIC,
    config: {
      name: 'NewRelicDeserialize',
      step: 'deserialize',
      priority: 'low',
      override: true
    }
  }
]
