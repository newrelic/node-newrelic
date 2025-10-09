/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const DcBase = require('../dc-base')
const initChannel = 'fastify.initialization'
const MiddlewareSubscriber = require('../middleware')

class FastifyInitialization extends DcBase {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'fastify' })
    this.channels = [
      { channel: initChannel, hook: this.handler }
    ]
    // not using the tracing channel bit, just the logic to wrap handler
    // should we create a class that is just for middleware wrapping that subscribers
    // construct?
    this.middleware = new MiddlewareSubscriber({ agent, logger, system: 'Fastify' })
  }

  handler({ fastify }) {
    const self = this
    fastify.addHook('onRoute', (routeOptions) => {
      if (!routeOptions.handler) {
        return
      }

      routeOptions.handler = self.middleware.wrapHandler({ handler: routeOptions.handler, route: routeOptions.path })
    })
  }
}

module.exports = FastifyInitialization
