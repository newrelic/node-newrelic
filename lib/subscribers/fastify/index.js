/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const DcBase = require('../dc-base')
const initChannel = 'fastify.initialization'
const { handlerWrapper } = require('./common')

class FastifyInitialization extends DcBase {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'fastify' })
    this.channels = [
      { channel: initChannel, hook: this.handler }
    ]
  }

  handler({ fastify }) {
    const self = this
    fastify.addHook('onRoute', (routeOptions) => {
      if (!routeOptions.handler) {
        return
      }

      routeOptions.handler = handlerWrapper({ handler: routeOptions.handler, route: routeOptions.path, self })
    })
  }
}

module.exports = FastifyInitialization
