/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  fn: middleware,
  config: {
    name: 'NewRelicHeader',
    step: 'finalizeRequest',
    priority: 'low',
    override: true
  }
}

/**
 * Middleware that adds the x-new-relic-disable-dt header to outgoing
 * AWS requests. This tells the agent's http-outbound instrumentation
 * not to add DT headers to these requests.
 *
 * @type {AwsSdkBoundMiddlewareFunction}
 */
function middleware (subscriber, config, next) {
  return async function wrappedHeaderMw(args) {
    args.request.headers['x-new-relic-disable-dt'] = 'true'
    return await next(args)
  }
}
