/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const DcBase = require('../dc-base')
const initChannel = 'fastify.initialization'
const MiddlewareWrapper = require('../middleware-wrapper')

class FastifyInitialization extends DcBase {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'fastify', skipUsageMetricRecording: true })
    this.channels = [
      { channel: initChannel, hook: this.handler }
    ]
    this.wrapper = new MiddlewareWrapper({ agent, logger, system: 'Fastify' })
  }

  handler({ fastify }) {
    const self = this
    fastify.addHook('onRoute', (routeOptions) => {
      if (!routeOptions.handler) {
        return
      }

      routeOptions.handler = self.wrapper.wrap({
        handler: routeOptions.handler,
        route: routeOptions.path
      })
    })
  }
}

module.exports = FastifyInitialization
