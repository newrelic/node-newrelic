/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'

const Subscriber = require('../base')
const nrMiddleware = require('./middleware/nr-specific/index.js')
const { segment: SYM_SEGMENT } = require('#agentlib/symbols.js')
const MIDDLEWARE = Symbol('nrMiddleware')

// Service-specific middleware by client name
const middlewareByClient = {
  BedrockRuntime: [...nrMiddleware, require('./middleware/bedrock/index.js')],
  Lambda: [...nrMiddleware, require('./middleware/lambda/index.js')],
  SNS: [...nrMiddleware, require('./middleware/sns/index.js')],
  SQS: [...nrMiddleware, require('./middleware/sqs/index.js')]
}

// clients handled by legacy instrumentation from lib/instrumentation/aws-sdk/v3
const legacyClients = new Set([
  'DynamoDB',
  'DynamoDBDocument'
])

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

    // remove once we migrate all legacy middleware
    if (legacyClients.has(clientName)) {
      return ctx
    }

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

  /**
   * When some instrumentations, e.g. the SNS one, do not instrument
   * specific execution paths, there should be an active segment attached to
   * the HTTP request that was added by the `http` instrumentation. If that
   * is the case, utilize that segment to attach the attributes. Otherwise,
   * utilize the current segment by way of the current context.
   *
   * @param {IncomingMessage} req http request to possibly pull segment from symbol
   * @returns {TraceSegment|null} active segment
   */
  getSegment(req) {
    return req[SYM_SEGMENT] || this.agent.tracer.getContext().segment
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
