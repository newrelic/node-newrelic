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
      data.arguments[1] = function wrapUse(...useArgs) {
        const [route, mwFn] = useArgs
        if (typeof route === 'function') {
          useArgs[0] = self.wrapHandler({ handler: route, hookName: 'onRequest' })
        } else {
          useArgs[1] = self.wrapHandler({ handler: mwFn, hookName: 'onRequest', route })
        }
        return fn.apply(this, useArgs)
      }
    }
  }
}

module.exports = FastifyDecorateSubscriber
