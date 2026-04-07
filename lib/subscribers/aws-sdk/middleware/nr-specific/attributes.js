/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const UNKNOWN = 'Unknown'

module.exports = {
  fn: middleware,
  config: {
    name: 'NewRelicDeserialize',
    step: 'deserialize',
    priority: 'low',
    override: true
  }
}

/**
 * Middleware that adds aws.* segment attributes from the AWS response.
 * Runs in the deserialize step so the response headers are available.
 *
 * @type {AwsSdkBoundMiddlewareFunction}
 */
function middleware (subscriber, config, next, context) {
  const { logger } = subscriber
  return async function wrappedAttrMw(args) {
    let region
    try {
      region = await config.region()
    } catch (err) {
      logger.debug(err, 'Failed to get the AWS region')
    }

    const result = await next(args)

    try {
      const { response } = result
      const segment = subscriber.getSegment(response.body.req)
      segment.addAttribute('aws.operation', context.commandName || UNKNOWN)
      segment.addAttribute('aws.requestId', response.headers['x-amzn-requestid'] || UNKNOWN)
      segment.addAttribute('aws.service', config.serviceId || UNKNOWN)
      segment.addAttribute('aws.region', region || UNKNOWN)
    } catch (err) {
      logger.debug(err, 'Failed to add AWS attributes to segment')
    }

    return result
  }
}
