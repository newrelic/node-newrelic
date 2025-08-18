/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NAMES = require('../../metrics/names')
const recordExternal = require('../../metrics/recorders/http_external')
const logger = require('../../logger').child({ component: 'http2' })
module.exports = initialize

function initialize(agent, http2, moduleName, shim) {
  shim.wrap(http2, 'connect', wrapConnect)
  shim.wrapReturn(http2, 'connect', wrapSession)

  /**
   * Wraps the http2 connect method in instrumentation
   *
   * @param {object} shim the generic shim with which the agent instruments
   * @param {Function} fn the original connect function
   * @returns {Function} an instrumented connect function
   */
  function wrapConnect(shim, fn) {
    return function wrappedConnect(...args) {
      const context = this
      return http2ConnectInstrumentation(shim, args, function makeConnection(args) {
        return fn.apply(context, args)
      })
    }
  }

  /**
   * Saves the connect URL as a custom attributes for later, when we record the .request external
   *
   * @param {object} shim the generic shim with which the agent instruments
   * @param {Array} args arguments to the original connect function
   * @param {Function} makeConnection Wrapped function that makes the connection
   * @returns {EventEmitter} The HTTP2 client session returned by .connect()
   */
  function http2ConnectInstrumentation(shim, args, makeConnection) {
    // We need the connect URL protocol for the request segment name.
    // We'll just save the URL string as an attribute on the transaction
    const txn = shim._agent.tracer.getTransaction()
    if (txn) {
      txn.trace.addCustomAttribute('http2ConnectUrl', args[0])
    }
    return makeConnection(args)
  }

  /**
   * Wraps the http2 client session
   *
   * @param {object} shim the generic shim with which the agent instruments
   * @param {Function} fn the original connect function
   * @param {String} fnName name of the connect function
   * @param {EventEmitter} session the current HTTP2 client session
   */
  // http2's connect method returns a session instance, from which the request is called
  function wrapSession(shim, fn, fnName, session) {
    shim.wrap(session, ['request'], wrapRequest)
    shim.wrap(Object.getPrototypeOf(session), ['error', 'frameError', 'timeout'], wrapSessionEnders)
  }

  /**
   * Wraps the http2 session's event emissions; used here to track errors and timeouts
   *
   * @param {object} shim the generic shim with which the agent instruments
   * @param {Function} fn the original connect function
   * @returns {Function} wrapped events
   */
  function wrapSessionEnders(shim, fn) {
    return function wrappedSessionEnders(...args) {
      const context = shim.tracer.getContext()
      const segment = shim.getActiveSegment()
      const emit = this.emit
      const newContext = context.enterSegment({ segment })
      const boundEmit = shim._agent.tracer.bindFunction(emit, newContext)

      if (!segment || !emit) {
        return fn.apply(this, args)
      }
      this.emit = wrappedEmit

      return fn.apply(this, args)

      function wrappedEmit(event, arg) {
        const transaction = agent.tracer.getTransaction()
        const isErrorEvent = ['error', 'frameError', 'timeout'].indexOf(event) > -1
        const nonZeroCode = arg && arg > 0
        const config = shim._agent.config
        // This assumes http config for errors/ignore should also apply here
        const shouldRecord = config?.http?.record_errors &&
          !config?.http?.ignore_status_codes.includes(arg)
        segment.end()
        if (isErrorEvent && nonZeroCode && shouldRecord) {
          handleError({ transaction, error: arg })
        }
        return boundEmit.apply(this, arguments)
      }
    }
  }

  /**
   * Notices the given error if there is no listener for the `error` event on the
   * request object.
   *
   * @param {object} params to function
   * @param {Transaction} params.transaction active transaction
   * @param {Error} params.error If provided, unhandled error that occurred during request
   * @returns {boolean} True if the error will be collected by New Relic.
   */
  function handleError({ transaction, error }) {
    logger.trace(error, 'Captured outbound error on behalf of the user.')
    transaction.agent.errors.add(transaction, error)
    return true
  }

  /**
   * Wraps the request and creates an external segment for it
   *
   * @param {object} shim shim passed in from wrapSession
   * @param {function} fn the http2 request returned from .connect()
   * @returns {function} wrapped request function
   */
  function wrapRequest(shim, fn) {
    return function wrappedRequest(...args) {
      // .request returns a stream; this too will need to be wrapped for streaming connections
      const txn = shim._agent.tracer.getTransaction()
      if (!txn) {
        logger.trace('Not in a transaction; not recording http2 external')
        return fn.apply(this, args)
      }
      const http2ConnectUrl = txn.trace.custom.attributes['http2ConnectUrl'].value

      const activeSegment = shim.getActiveSegment()
      const context = this

      // args[0] to this function is request headers.
      // collect host, port, and path from the args[0] object
      const host = args[0][':authority'] // host and port
      const path = args[0][':path']
      const method = args[0][':method']
      const name = NAMES.EXTERNAL.PREFIX + host + path

      const segment = shim.createSegment({
        name,
        opaque: true,
        recorder: recordExternal(host, 'http2'),
        parent: activeSegment
      })

      // The :authority header of .request() does not contain protocol,
      // but we've saved that during .connect()
      const { protocol, port, hostname } = new URL(http2ConnectUrl)

      return shim.applySegment(makeRequest, segment, true, this, args)

      function makeRequest() {
        const originalMetadata = args[0]
        const nrMetadata = { ...originalMetadata }

        const outboundAgentHeaders = Object.create(null)
        if (shim.agent.config.distributed_tracing.enabled) {
          txn.insertDistributedTraceHeaders(outboundAgentHeaders)
          Object.keys(outboundAgentHeaders).forEach((key) => {
            nrMetadata[key] = outboundAgentHeaders[key]
          })
        } else {
          shim.logger.debug('Distributed tracing disabled by instrumentation.')
        }
        args[0] = nrMetadata

        segment.addAttribute('component', 'http2')
        segment.captureExternalAttributes({
          protocol,
          hostname,
          host,
          method,
          port,
          path
        })

        return fn.apply(context, args)
      }
    }
  }
}
