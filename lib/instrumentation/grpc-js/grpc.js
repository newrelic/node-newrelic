/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const recordExternal = require('../../metrics/recorders/http_external')
const recordHttp = require('../../metrics/recorders/http')
const { DESTINATIONS } = require('../../config/attribute-filter')
const DESTINATION = DESTINATIONS.TRANS_EVENT | DESTINATIONS.ERROR_EVENT
const semver = require('semver')

module.exports.wrapStartResolve = function wrappedClient(shim, resolvingCall) {
  shim.wrap(resolvingCall.ResolvingCall.prototype, 'start', wrapStart)
}

module.exports.wrapStartCall = function wrappedClient(shim, callStream) {
  shim.wrap(callStream.Http2CallStream.prototype, 'start', wrapStart)
}

module.exports.wrapServer = function wrapServer(shim, server) {
  const grpcVersion = shim.pkgVersion
  if (semver.lt(grpcVersion, '1.4.0')) {
    shim.logger.debug('gRPC server-side instrumentation only supported on grpc-js >=1.4.0')
    return
  }

  shim.setFramework('gRPC')
  shim.wrap(server.Server.prototype, 'register', wrapRegister)
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

    const channel = this.channel
    const authorityName = (channel.target && channel.target.path) || channel.getDefaultAuthority
    // in 1.8.0 this changed from methodName to method
    const method = this.methodName || this.method

    const segment = shim.createSegment({
      name: `External/${authorityName}${method}`,
      opaque: true,
      recorder: recordExternal(authorityName, 'gRPC')
    })

    return shim.applySegment(callStart, segment, true, this, arguments)

    function callStart() {
      const args = shim.argsToArray.apply(shim, arguments)

      const transaction = segment.transaction

      const originalMetadata = args[0]
      const nrMetadata = originalMetadata.clone()

      const outboundAgentHeaders = Object.create(null)
      if (shim.agent.config.distributed_tracing.enabled) {
        transaction.insertDistributedTraceHeaders(outboundAgentHeaders)
        Object.keys(outboundAgentHeaders).forEach((key) => {
          nrMetadata.add(key, outboundAgentHeaders[key])
        })
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
          shim.agent.errors.add(segment.transaction, details)
        }

        segment.addAttribute('component', 'gRPC')

        const protocol = 'grpc'

        const url = `${protocol}://${authorityName}${method}`

        segment.addAttribute('http.url', url)
        segment.addAttribute('http.method', method)

        if (originalListener && originalListener.onReceiveStatus) {
          const onReceiveStatuts = shim.bindSegment(originalListener.onReceiveStatus, segment)
          onReceiveStatuts(status)
        }
        segment.end()
      }

      args[1] = nrListener

      return original.apply(this, args)
    }
  }
}

/**
 * Instruments the grpc-js server by intercepting the moment when
 * server methods are registered from the method implementations
 * provided to grpc-js. This handles all four types of server
 * invocations: unary, client-streaming, server-streaming, and
 * bidirectional streaming.
 *
 * @param {object} shim the web shim to instrument with
 * @param {Function} original the original function
 * @returns {Function} the instrumented function
 */
function wrapRegister(shim, original) {
  const constants = shim.require('./build/src/constants')

  return function wrappedRegister() {
    const args = shim.argsToArray.apply(shim, arguments)

    const name = args[0]
    const handler = args[1]
    const type = args[args.length - 1]

    if (this.handlers.has(name)) {
      shim.logger.debug(
        `Not re-instrumenting gRPC method handler for ${name}: it is already registered in the server.`
      )
      return original.apply(this, arguments)
    }

    args[1] = shim.bindCreateTransaction(instrumentedHandler, { type: shim.WEB })

    return original.apply(this, args)

    function instrumentedHandler(stream) {
      const { transaction, segment } = createTransaction()
      acceptDTHeaders(stream, transaction)
      instrumentEventListeners(stream, transaction)
      return shim.applySegment(handler, segment, true, this, arguments)
    }

    function createTransaction() {
      const parent = shim.getActiveSegment()
      const transaction = parent.transaction

      // Create the transaction segment using the request URL for now. Once a
      // better name can be determined this segment will be renamed to that.
      const segment = shim.createSegment(name, recordHttp)
      segment.start()

      transaction.type = 'web'
      transaction.baseSegment = segment
      transaction.url = name

      transaction.trace.attributes.addAttribute(DESTINATION, 'request.method', transaction.url)

      transaction.trace.attributes.addAttribute(DESTINATION, 'request.uri', transaction.url)

      shim.setTransactionUri(transaction.url)

      // This attribute isn't required by the spec, but it seems useful to have
      transaction.trace.attributes.addAttribute(DESTINATION, 'grpc.type', type)
      return { transaction, segment }
    }

    function acceptDTHeaders(stream, transaction) {
      const metadata = stream.metadata
      Object.entries(metadata.getMap()).forEach(([key, value]) => {
        transaction.trace.attributes.addAttribute(DESTINATION, `request.headers.${key}`, value)
      })

      const headers = Object.create(null)
      headers.tracestate = metadata.get('tracestate').join(',')
      headers.traceparent = metadata.get('traceparent').join(',')
      headers.newrelic = metadata.get('newrelic').join(',')
      transaction.acceptDistributedTraceHeaders('HTTP', headers)
    }

    function instrumentEventListeners(stream, transaction) {
      const agent = shim.agent
      const config = agent.config
      stream.call.once('callEnd', (statusCode) => {
        transaction.trace.attributes.addAttribute(DESTINATION, 'response.status', statusCode)
        if (shouldTrackError(statusCode, config)) {
          const status = constants.Status[statusCode]
          const error = new Error(`gRPC status code ${statusCode}: ${status}`)
          agent.errors.add(transaction, error)
        }
      })
      stream.call.once('streamEnd', () => {
        transaction.end()
      })
      // TODO should also instrument the 'data' event on the stream
      // object, as that can ensue in lots of processing when the
      // client is streaming. https://issues.newrelic.com/browse/NEWRELIC-1460
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
