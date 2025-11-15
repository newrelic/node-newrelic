/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MiddlewareSubscriber = require('../middleware')
/**
 * These are the events that occur during a fastify
 * request
 * see: https://www.fastify.io/docs/latest/Lifecycle/
 *
 * Note: preSerialization and onSend happen after the route handler
 * executes.  `onResponse` does not execute until after the client
 * sends the response so it'll never be in scope of the transaction
 */
const REQUEST_HOOKS = [
  'onRequest',
  'preParsing',
  'preValidation',
  'preHandler',
  'preSerialization',
  'onSend',
  'onResponse',
  'onError'
]

class FastifyAddHookSubscriber extends MiddlewareSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'fastify', channelName: 'nr_addHook', system: 'Fastify' })
  }

  handler(data) {
    const { arguments: args } = data
    const [hookName, fn] = args
    if (REQUEST_HOOKS.includes(hookName)) {
      const prefix = `${this.wrapper.prefix}/${hookName}`
      const wrappedFn = this.wrapper.wrap({ handler: fn, prefix })
      data.arguments[1] = wrappedFn
    }
  }
}

module.exports = FastifyAddHookSubscriber
