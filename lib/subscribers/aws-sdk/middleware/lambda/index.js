/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Defines a deserialize middleware to add the
 * cloud.resource_id segment attributes for the AWS command
 *
 * @type {AwsSdkBoundMiddlewareFunction}
 */
function resourceIdMiddleware(subscriber, config, next) {
  const { logger } = subscriber
  // We can't derive account ID, so we have to consume it from config
  const accountId = subscriber.config.cloud.aws.account_id
  return async function wrappedResourceIdMiddleware(args) {
    let result
    try {
      const region = await config.region()
      result = await next(args)
      const { response } = result
      const segment = subscriber.getSegment(response.body.req)
      const functionName = args?.input?.FunctionName // have to get function from params
      if (accountId && functionName) {
        segment.addAttribute(
          'cloud.resource_id',
          `arn:aws:lambda:${region}:${accountId}:function:${functionName}`
        )
        segment.addAttribute('cloud.platform', 'aws_lambda')
      }
    } catch (err) {
      logger.debug(err, 'Failed to add AWS cloud resource id to segment')
    }
    return result
  }
}

module.exports = {
  fn: resourceIdMiddleware,
  config: {
    name: 'NewRelicGetResourceId',
    step: 'deserialize',
    priority: 'low',
    override: true
  }
}
