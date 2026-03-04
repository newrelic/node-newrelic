/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('node:path')
const semver = require('semver')
const Subscriber = require('../base.js')
const Transaction = require('#agentlib/transaction/index.js')
const recordHttp = require('#agentlib/metrics/recorders/http.js')
const symbols = require('#agentlib/symbols.js')
const { ACTION_DELIMITER } = require('#agentlib/metrics/names.js')
const { DESTINATIONS, TYPES } = Transaction

const DESTINATION = DESTINATIONS.TRANS_EVENT | DESTINATIONS.ERROR_EVENT
const FRAMEWORK = 'gRPC'

module.exports = class GrpcServerSubscriber extends Subscriber {
  #constants = {}

  constructor({ agent, logger, ...rest }) {
    super({
      agent,
      logger,
      packageName: '@grpc/grpc-js',
      channelName: 'nr_grpc_server',
      ...rest
    })

    this.#constants = this.#loadConstants()

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
      const { transaction } = self.#createContext(self, handlerName, handlerType)
      const stream = args[0]
      self.#acceptDtHeaders(self, transaction, stream)

      if (semver.gte(moduleVersion, '1.10.0') === true) {
        self.#instrumentInterceptors(self, transaction, stream)
      } else {
        self.#instrumentEventListeners(self, transaction, stream)
      }

      return handlerFn.apply(server, args)
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

  #createContext(instance, handlerName, handlerType) {
    let ctx = instance.agent.tracer.getContext()
    let transaction = ctx.transaction
    if (!transaction) {
      transaction = new Transaction(instance.agent)
      ctx = ctx.enterTransaction(transaction)
    }

    ctx = instance.createSegment({ name: handlerName, recorder: recordHttp, ctx })
    const { segment } = ctx

    transaction.type = TYPES.WEB
    transaction.baseSegment = segment
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

    return ctx
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
   * @param {object} stream The gRPC stream.
   */
  #instrumentEventListeners(instance, transaction, stream) {
    const { agent } = instance
    const { config } = agent

    stream.call.once('callEnd', function nrCallEnd(statusCode) {
      transaction.trace.attributes.addAttribute(
        DESTINATION,
        'response.status',
        statusCode
      )
      if (shouldTrackError(statusCode, config) === true) {
        const status = instance.#constants.Status[statusCode]
        const error = Error(`gRPC status code ${statusCode}: ${status}`)
        agent.errors.add(transaction, error)
      }
    })
    stream.call.once('streamEnd', function nrStreamEnd() {
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
   * @param {object} stream The gRPC stream.
   */
  #instrumentInterceptors(instance, transaction, stream) {
    const { agent } = instance
    const { config } = agent
    const onCallEnd = stream.call.callEventTracker.onCallEnd

    if (onCallEnd[symbols.wrapped] === true) {
      return
    }

    stream.call.callEventTracker.onCallEnd = function wrappedOnCallEnd(...args) {
      const [{ code: statusCode }] = args
      transaction.trace.attributes.addAttribute(
        DESTINATION,
        'response.status',
        statusCode
      )

      if (shouldTrackError(statusCode, config) === true) {
        const status = instance.#constants.Status[statusCode]
        const error = Error(`gRPC status code ${statusCode}: ${status}`)
        agent.errors.add(transaction, error)
      }
      transaction.end()
      return onCallEnd.apply(stream.call.callEventTracker, args)
    }
    stream.call.callEventTracker.onCallEnd[symbols.wrapped] = true
  }

  #loadConstants() {
    const modPath = path.dirname(require.resolve('@grpc/grpc-js'))
    return require(
      path.join(modPath, 'constants.js')
    )
  }
}

function shouldTrackError(statusCode, config) {
  return statusCode > 0 &&
    config.grpc.record_errors === true &&
    config.grpc.ignore_status_codes.includes(statusCode) === false
}
