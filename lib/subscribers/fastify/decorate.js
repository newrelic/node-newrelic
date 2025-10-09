/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const MiddlewareSubscriber = require('../middleware')

class FastifyDecorateSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'fastify', channelName: 'nr_decorate', system: 'Fastify' })
  }

  handler(data) {
    const self = this
    const { arguments: args } = data
    const [name, fn] = args
    if (name === 'use') {
      const prefix = `${self.wrapper.prefix}/onRequest`
      data.arguments[1] = function wrapUse(...useArgs) {
        const [route, mwFn] = useArgs
        if (typeof route === 'function') {
          useArgs[0] = self.wrapper.wrap({ handler: route, prefix })
        } else {
          useArgs[1] = self.wrapper.wrap({ handler: mwFn, prefix, route })
        }
        return fn.apply(this, useArgs)
      }
    }
  }
}

module.exports = FastifyDecorateSubscriber
