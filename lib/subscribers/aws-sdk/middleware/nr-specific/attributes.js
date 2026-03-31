/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { segment: SYM_SEGMENT } = require('#agentlib/symbols.js')
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
  const { agent, logger } = subscriber
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
      // When some instrumentations, e.g. the SNS one, do not instrument
      // specific execution paths, there should be an active segment attached to
      // the HTTP request that was added by the `http` instrumentation. If that
      // is the case, utilize that segment to attach the attributes. Otherwise,
      // utilize the current segment by way of the current context.
      const segment = response.body.req[SYM_SEGMENT] ||
        agent.tracer.getContext().segment
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
