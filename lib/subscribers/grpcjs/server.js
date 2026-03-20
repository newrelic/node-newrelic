/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')
const Subscriber = require('../base.js')
const Transaction = require('#agentlib/transaction/index.js')
const recordHttp = require('#agentlib/metrics/recorders/http.js')
const { ACTION_DELIMITER } = require('#agentlib/metrics/names.js')
const { DESTINATIONS, TYPES } = Transaction

const DESTINATION = DESTINATIONS.TRANS_EVENT | DESTINATIONS.ERROR_EVENT
const FRAMEWORK = 'gRPC'

module.exports = class GrpcServerSubscriber extends Subscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      packageName: '@grpc/grpc-js',
      channelName: 'nr_grpc_server',
    })

    this.agent.environment.setFramework(FRAMEWORK)

    // We instrument the `grpcjs.Server.register` method in order to capture
    // the handlers that are being registered. These captured handlers will
    // start the transaction. Without `requireActiveTx = false`, our handler
    // will never be invoked. We need our handler invoked in order to do the
    // capturing.
    this.requireActiveTx = false
  }

  handler(data, ctx) {
    const { arguments: _arguments, self: server, moduleVersion } = data
    const args = Array.from(_arguments)
    const handlerName = args.at(0)
    const handlerFn = args.at(1)
    const handlerType = args.at(-1)

    if (server.handlers.has(handlerName) === true) {
      this.logger.debug(
        `Not re-instrumenting gRPC method handler for ${handlerName}: it is already registered in the server.`
      )
      return server.register(...arguments)
    }

    const self = this
    _arguments[1] = function wrappedGrpcHandler(...args) {
      let ctx = self.agent.tracer.getContext()
      if (ctx.transaction != null) {
        // If a transaction already exists, we run the function under that
        // transaction.
        return handlerFn.apply(server, args)
      }

      ctx = self.#createTransaction(self, handlerName, handlerType, ctx)
      const transaction = ctx.transaction
      const destination = args[0]
      self.#acceptDtHeaders(self, transaction, destination)

      if (semver.gte(moduleVersion, '1.10.0') === true) {
        self.#instrumentInterceptors(self, transaction, destination)
      } else {
        self.#instrumentEventListeners(self, transaction, destination)
      }

      return self.agent.tracer.bindFunction(handlerFn, ctx).apply(server, args)
    }

    return ctx
  }

  /**
   * Reads W3C metadata from the gRPC stream and adds it to the current
   * transaction.
   *
   * @param {GrpcServerSubscriber} instance The subscriber instance.
   * @param {Transaction} transaction The current transaction.
   * @param {object} stream The gRPC stream.
   */
  #acceptDtHeaders(instance, transaction, stream) {
    const { metadata } = stream
    for (const [key, value] of Object.entries(metadata.getMap())) {
      transaction.trace.attributes.addAttribute(
        DESTINATION,
        `request.headers.${key}`,
        value
      )
    }

    const headers = Object.create(null)
    headers.tracestate = metadata.get('tracestate').join(',')
    headers.traceparent = metadata.get('traceparent').join(',')
    headers.newrelic = metadata.get('newrelic').join(',')
    transaction.acceptDistributedTraceHeaders('HTTP', headers)
  }

  /**
   * In the case of requests that do not already have an active transaction
   * when the handler is invoked, this method is used to create a new one
   * with a newly entered {@link TraceSegment}.
   *
   * @param {GrpcServerSubscriber} instance The subscriber instance.
   * @param {string} handlerName The name of the handler. Used to name the
   * segment.
   * @param {string} handlerType The gRPC server handler type as enumerated at
   * https://github.com/grpc/grpc-node/blob/c9f8f93/packages/grpc-js/src/server-call.ts#L397
   * @param {AsyncContext} currentCtx The current context handle. It is expected
   * that the context will not have a transaction associated with it.
   *
   * @returns {AsyncContext} A new context to be utilized for the current
   * request.
   */
  #createTransaction(instance, handlerName, handlerType, currentCtx) {
    let transaction = new Transaction(instance.agent)
    currentCtx = currentCtx.enterTransaction(transaction)

    currentCtx = instance.createSegment({
      name: handlerName,
      recorder: recordHttp,
      ctx: currentCtx
    })
    transaction = currentCtx.transaction

    transaction.type = TYPES.WEB
    transaction.baseSegment = currentCtx.segment
    // Initialize with the handler name until a better name can be derived.
    transaction.url = handlerName
    transaction.trace.attributes.addAttribute(DESTINATION, 'request.method', transaction.url)
    transaction.trace.attributes.addAttribute(DESTINATION, 'request.uri', transaction.url)
    transaction.nameState.setName(
      FRAMEWORK,
      transaction.verb,
      ACTION_DELIMITER,
      transaction.url
    )
    // 'grpc.type' is not required in the spec, but good metadata to include.
    transaction.trace.attributes.addAttribute(DESTINATION, 'grpc.type', handlerType)

    return currentCtx
  }

  /**
   * Does the same thing as {@link GrpcServerSubscriber.#instrumentInterceptors},
   * but for streams that worked as event emitters (i.e. old versions of the
   * module).
   *
   * Note: two listeners are registered as callEnd is emitted before streamEnd.
   * Unlike the instrumentInterceptors case where onCallEnd is called last.
   *
   * @param {GrpcServerSubscriber} instance The subscriber instance.
   * @param {Transaction} transaction The current transaction.
   * @param {object} handler The gRPC request handler.
   */
  #instrumentEventListeners(instance, transaction, handler) {
    const { agent } = instance
    const { config } = agent

    handler.call.once('callEnd', function nrCallEnd(statusCode) {
      transaction.trace.attributes.addAttribute(
        DESTINATION,
        'response.status',
        statusCode
      )
      if (shouldTrackError(statusCode, config) === true) {
        const error = Error(`gRPC status code ${statusCode}`)
        agent.errors.add(transaction, error)
      }
    })
    handler.call.once('streamEnd', function nrStreamEnd() {
      transaction.end()
    })
  }

  /**
   * Wraps the gRPC stream's `onCallEnd` method in order to capture the
   * `response.status` metadata field, log any trackable errors, and end
   * the transaction.
   *
   * @param {GrpcServerSubscriber} instance The subscriber instance.
   * @param {Transaction} transaction The current transaction.
   * @param {object} handler The gRPC request handler.
   */
  #instrumentInterceptors(instance, transaction, handler) {
    const { agent } = instance
    const { config } = agent
    const onCallEnd = handler.call.callEventTracker.onCallEnd

    handler.call.callEventTracker.onCallEnd = function wrappedOnCallEnd(...args) {
      const [{ code: statusCode }] = args
      transaction.trace.attributes.addAttribute(
        DESTINATION,
        'response.status',
        statusCode
      )

      if (shouldTrackError(statusCode, config) === true) {
        const error = Error(`gRPC status code ${statusCode}`)
        agent.errors.add(transaction, error)
      }
      transaction.end()
      return onCallEnd.apply(handler.call.callEventTracker, args)
    }
  }
}

function shouldTrackError(statusCode, config) {
  return statusCode > 0 &&
    config.grpc.record_errors === true &&
    config.grpc.ignore_status_codes.includes(statusCode) === false
}
