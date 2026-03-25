/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base.js')
const shouldTrackError = require('./should-track-error.js')
const recordExternal = require('#agentlib/metrics/recorders/http_external.js')

module.exports = class GrpcClientSubscriber extends Subscriber {
  constructor({ agent, logger, channelName }) {
    super({
      agent,
      logger,
      channelName,
      packageName: '@grpc/grpc-js',
    })

    this.opaque = true
  }

  handler(data, ctx) {
    const { arguments: args, self: client } = data
    const { transaction } = ctx

    const { channel } = client
    const authority = channel.target?.path || channel.getDefaultAuthority
    // In grpc-js>=1.8.0  `.methodName` becomes `.method`.
    const method = client.methodName || client.method

    const newCtx = this.createSegment({
      name: `External/${authority}${method}`,
      recorder: recordExternal(authority, 'gRPC'),
      ctx
    })

    // Acquire the original parameters to the handler, create patched
    // versions of them, and update the parameters list with the patched
    // instances.
    const origMetadata = args[0]
    const origListener = args[1]
    const nrMetadata = origMetadata.clone()
    const nrListener = Object.assign({}, origListener)
    args[0] = nrMetadata
    args[1] = nrListener

    this.#addDistributedTraceHeaders(transaction, nrMetadata)
    this.#wrapListenerCallback(nrListener, origListener, authority, method, newCtx)

    return newCtx
  }

  /**
   * When distributed tracing (DT) is enabled, pull DT headers from the
   * provided transaction and add them to the metadata object used by gRPC
   * when delivering data.
   *
   * @param {Transaction} transaction The transaction that contains the DT data.
   * @param {object} destination The gRPC metadata object to add headers to.
   * This object will be mutated.
   */
  #addDistributedTraceHeaders(transaction, destination) {
    if (this.agent.config.distributed_tracing.enabled === false) {
      this.logger.debug('Distributed tracing disabled by instrumentation.')
      return
    }

    const outboundAgentHeaders = Object.create(null)
    transaction.insertDistributedTraceHeaders(outboundAgentHeaders)
    for (const [key, value] of Object.entries(outboundAgentHeaders)) {
      destination.add(key, value)
    }
  }

  /**
   * When the original gRPC "listener" object has an `onReceiveStatus` method
   * defined, wrap that method to capture tracing data and attach the wrapped
   * method to the patched `nrListener` instance.
   *
   * @param {object} nrListener New Relic clone of the original listener.
   * @param {object} origListener Original gRPC listener object.
   * @param {string} authority Value of the `:authority` header.
   * @param {string} method The gRPC method name to be invoked.
   * @param {AsyncContext} ctx The context to execute the `onReceiveStatus`
   * handler under.
   */
  #wrapListenerCallback(nrListener, origListener, authority, method, ctx) {
    if (typeof origListener?.onReceiveStatus !== 'function') {
      return
    }

    const agent = this.agent
    const [hostname, port] = authority.split(':')

    nrListener.onReceiveStatus = function nrOnReceiveStatus(status) {
      const { segment, transaction } = ctx
      const { code, details } = status
      segment.addAttribute('grpc.statusCode', code)
      segment.addAttribute('grpc.statusText', details)
      segment.addAttribute('component', 'gRPC')

      if (shouldTrackError(code, agent.config) === true) {
        agent.errors.add(transaction, details)
      }

      const protocol = 'grpc:'
      segment.captureExternalAttributes({
        protocol,
        host: authority,
        port,
        hostname,
        method,
        path: method
      })

      const boundFn = agent.tracer.bindFunction(
        origListener.onReceiveStatus,
        ctx,
        true
      )
      boundFn(status)
    }
  }
}
