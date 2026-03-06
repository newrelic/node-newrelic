/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const recordExternal = require('../../metrics/recorders/http_external')

module.exports.wrapStartResolve = function wrappedClient(shim, resolvingCall) {
  shim.wrap(resolvingCall.ResolvingCall.prototype, 'start', wrapStart)
}

module.exports.wrapStartCall = function wrappedClient(shim, callStream) {
  shim.wrap(callStream.Http2CallStream.prototype, 'start', wrapStart)
}

/**
 * Instruments grpc-js client by intercepting the function that
 * initiates client requests. This handles all four types of client
 * invocations: unary, client-streaming, server-streaming, and
 * bidirectional streaming.
 *
 * @param {object} shim the generic shim to instrument with
 * @param {Function} original the original function
 * @returns {Function} the instrumented function
 */
function wrapStart(shim, original) {
  return function wrappedStart() {
    const activeSegment = shim.getActiveSegment()
    if (!activeSegment) {
      return original.apply(this, arguments)
    }

    const transaction = shim.tracer.getTransaction()
    const channel = this.channel
    const authorityName = (channel.target && channel.target.path) || channel.getDefaultAuthority
    // in 1.8.0 this changed from methodName to method
    const method = this.methodName || this.method

    const segment = shim.createSegment({
      name: `External/${authorityName}${method}`,
      opaque: true,
      recorder: recordExternal(authorityName, 'gRPC'),
      parent: activeSegment
    })

    return shim.applySegment(callStart, segment, true, this, arguments)

    function callStart(...args) {
      const originalMetadata = args[0]
      const nrMetadata = originalMetadata.clone()

      const outboundAgentHeaders = Object.create(null)
      if (shim.agent.config.distributed_tracing.enabled) {
        transaction.insertDistributedTraceHeaders(outboundAgentHeaders)
        for (const [key, value] of Object.entries(outboundAgentHeaders)) {
          nrMetadata.add(key, value)
        }
      } else {
        shim.logger.debug('Distributed tracing disabled by instrumentation.')
      }

      args[0] = nrMetadata

      const originalListener = args[1]
      const nrListener = Object.assign({}, originalListener)
      nrListener.onReceiveStatus = (status) => {
        const { code, details } = status

        segment.addAttribute('grpc.statusCode', code)
        segment.addAttribute('grpc.statusText', details)

        const agent = shim.agent
        const config = agent.config

        if (shouldTrackError(code, config)) {
          shim.agent.errors.add(transaction, details)
        }

        segment.addAttribute('component', 'gRPC')

        const protocol = 'grpc:'
        const [hostname, port] = authorityName.split(':')

        segment.captureExternalAttributes({
          protocol,
          host: authorityName,
          port,
          hostname,
          method,
          path: method
        })

        if (originalListener && originalListener.onReceiveStatus) {
          const onReceiveStatus = shim.bindSegment(originalListener.onReceiveStatus, segment)
          onReceiveStatus(status)
        }
        segment.end()
      }

      args[1] = nrListener

      return original.apply(this, args)
    }
  }
}

function shouldTrackError(statusCode, config) {
  return (
    statusCode > 0 &&
    config.grpc.record_errors &&
    !config.grpc.ignore_status_codes.includes(statusCode)
  )
}
