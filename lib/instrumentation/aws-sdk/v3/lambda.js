/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// const { OperationSpec } = require('../../../shim/specs')
const InstrumentationDescriptor = require('../../../instrumentation-descriptor')

/**
 * Wraps the deserialize middleware step to add the
 * cloud.resource_id segment attributes for the AWS command
 *
 * @param {Shim} shim
 * @param {Object} config AWS command configuration
 * @param {function} next next function in middleware chain
 * @returns {function}
 */
function resourceIdMiddleware(shim, config, next) {
  return async function wrappedResourceIdMiddleware(args) {
    let region
    try {
      region = await config.region()
      const segment = shim.getSegment()

      // We can't derive account ID, so we have to consume it from config
      const accountId = shim.agent.config.cloud.aws.account_id
      const functionName = args?.input?.FunctionName // have to get function from params
      if (accountId && functionName) {
        segment.addAttribute(
          'cloud.resource_id',
          `arn:aws:lambda:${region}:${accountId}:function:${functionName}`
        )
        segment.addAttribute('cloud.platform', `aws_lambda`)
      }
    } catch (err) {
      shim.logger.debug(err, 'Failed to add AWS cloud resource id to segment')
    }

    return next(args)
  }
}

const lambdaMiddlewareConfig = {
  middleware: resourceIdMiddleware,
  type: InstrumentationDescriptor.TYPE_GENERIC,
  config: {
    name: 'NewRelicGetResourceId',
    step: 'finalizeRequest',
    priority: 'low',
    override: true
  }
}

module.exports = {
  lambdaMiddlewareConfig
}
