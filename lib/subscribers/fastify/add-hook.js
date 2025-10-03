/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base')
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
const { handlerWrapper } = require('./common')

class FastifyAddHookSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'fastify', channelName: 'nr_addHook' })
    this.requireActiveTx = false
  }

  handler(data) {
    const { arguments: args } = data
    const [hookName, fn] = args
    if (REQUEST_HOOKS.includes(hookName)) {
      const wrappedFn = handlerWrapper({ handler: fn, hookName, self: this })
      data.arguments[1] = wrappedFn
    }
  }
}

module.exports = FastifyAddHookSubscriber
