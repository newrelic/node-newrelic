/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'

const Subscriber = require('../base')
const nrMiddleware = require('./middleware/nr-specific/index.js')
const MIDDLEWARE = Symbol('nrMiddleware')

// Service-specific middleware by client name
const middlewareByClient = {
  BedrockRuntime: [...nrMiddleware, require('./middleware/bedrock/index.js')],
  SNS: [...nrMiddleware, require('./middleware/sns/index.js')]
}

/**
 * Subscriber for `@smithy/smithy-client` `Client.send()` calls. Registers
 * common AWS middleware (DT header suppression, response attributes) and
 * dispatches service-specific middleware via the `middlewareByClient` map.
 *
 * Only clients listed in `middlewareByClient` are handled here; all others
 * fall through to the existing shim-based instrumentation. This eliminates
 * the need for separate subscriber configs per AWS service package — a single
 * hook on `Client.send` covers every service, since all AWS SDK v3 clients
 * extend `@smithy/smithy-client.Client`.
 */
module.exports = class SmithyClientSendSubscriber extends Subscriber {
  constructor({ agent, logger, packageName = '@smithy/smithy-client' }) {
    super({ agent, logger, channelName: 'nr_send', packageName })
    this.events = ['end']
  }

  handler(data, ctx) {
    const { self: client } = data
    const clientName = client.constructor.name.replace(/Client$/, '')

    // Clients not in `middlewareByClient` (e.g. APIGateway, S3) fall back
    // to the common nrMiddleware for basic header/attribute instrumentation.
    const middlewares = middlewareByClient[clientName] || nrMiddleware
    this.logger.trace('Sending with client %s', clientName)

    // Only attach middleware to a client instance once.
    // The symbol guard is on the client, not the subscriber,
    // because each client instance needs its own registration.
    if (!client[MIDDLEWARE]) {
      client[MIDDLEWARE] = true
      const config = client.config

      for (const mw of middlewares) {
        if (shouldRegister(mw, this, data) === false) {
          this.logger.trace('Skipping middleware %s for %s', mw.config.name, clientName)
          continue
        }

        this.logger.trace('Registering middleware %s for %s', mw.config.name, clientName)
        const boundFn = mw.fn.bind(null, this, config)
        client.middlewareStack.add(boundFn, mw.config)
      }
    }

    return ctx
  }
}

function shouldRegister(middleware, subscriber, data) {
  // Utility middlewares do not need initialization. So the absence of the
  // method indicates it should be registered. Otherwise, we need to invoke
  // the init method and check the result.
  return Object.hasOwn(middleware, 'init') === false ||
    (
      typeof middleware.init === 'function' &&
      middleware.init(subscriber, data) === true
    )
}
