/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base')
const { handlerWrapper } = require('./common')

class FastifyDecorateSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'fastify', channelName: 'nr_decorate' })
    this.requireActiveTx = false
  }

  handler(data) {
    const self = this
    const { arguments: args } = data
    const [name, fn] = args
    if (name === 'use') {
      data.arguments[1] = function wrapUse(...useArgs) {
        const [route, mwFn] = useArgs
        if (typeof route === 'function') {
          useArgs[0] = handlerWrapper({ handler: route, hookName: 'onRequest', self })
        } else {
          useArgs[1] = handlerWrapper({ handler: mwFn, hookName: 'onRequest', route, self })
        }
        return fn.apply(this, useArgs)
      }
    }
  }
}

module.exports = FastifyDecorateSubscriber
