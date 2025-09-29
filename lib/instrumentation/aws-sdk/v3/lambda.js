/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const InstrumentationDescriptor = require('../../../instrumentation-descriptor')

/**
 * Defines a deserialize middleware to add the
 * cloud.resource_id segment attributes for the AWS command
 *
 * @param {Shim} shim New Relic agent shim
 * @param {object} config AWS command configuration
 * @param {Function} next next function in middleware chain
 * @returns {Function} wrapped version of middleware function
 */
function resourceIdMiddleware(shim, config, next) {
  return async function wrappedResourceIdMiddleware(args) {
    let result
    try {
      const region = await config.region()
      result = await next(args)
      const { response } = result
      const segment = shim.getSegment(response.body.req)
      // We can't derive account ID, so we have to consume it from config
      const accountId = shim.agent.config.cloud.aws.account_id
      const functionName = args?.input?.FunctionName // have to get function from params
      if (accountId && functionName) {
        segment.addAttribute(
          'cloud.resource_id',
          `arn:aws:lambda:${region}:${accountId}:function:${functionName}`
        )
        segment.addAttribute('cloud.platform', 'aws_lambda')
      }
    } catch (err) {
      shim.logger.debug(err, 'Failed to add AWS cloud resource id to segment')
    }
    return result
  }
}

const lambdaMiddlewareConfig = {
  middleware: resourceIdMiddleware,
  type: InstrumentationDescriptor.TYPE_GENERIC,
  config: {
    name: 'NewRelicGetResourceId',
    step: 'deserialize',
    priority: 'low',
    override: true
  }
}

module.exports = {
  lambdaMiddlewareConfig
}
