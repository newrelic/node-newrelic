/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const url = require('node:url')
const NAMES = require('../../metrics/names')
const recordExternal = require('../../metrics/recorders/http_external')
const symbols = require('../../symbols')
const logger = require('../../logger').child({ component: 'http2' })
module.exports = initialize

function initialize(agent, http2, moduleName, shim) {
  shim.wrap(http2, 'connect', wrapConnect)
  shim.wrapReturn(http2, 'connect', wrapSession)

  function wrapConnect(shim, fn) {
    return function wrappedConnect(...args) {
      const context = this
      return http2ConnectInstrumentation(shim, args, function makeConnection(args) {
        return fn.apply(context, args)
      })
    }
  }

  function http2ConnectInstrumentation(shim, args, makeConnection) {
    // We need the connect URL protocol for the request segment name.
    // We'll just save the URL string as an attribute on the transaction
    const txn = shim._agent.tracer.getTransaction()
    if (txn) {
      // clientHttp2Streaming flow should be http2 connect > (get session) session.request > (get client stream)
      txn.trace.addCustomAttribute('http2ConnectUrl', args[0])
    }
    return makeConnection(args)
  }

  // http2's connect method returns a session instance, from which the request is called
  function wrapSession(shim, fn, fnName, session) {
    shim.wrap(session, ['request'], wrapRequest)

    // These aren't needed for chat completion, and may not be needed for anything else
    // shim.wrap(Object.getPrototypeOf(session), ['ref', 'unref', 'close', 'destroy', 'goaway', 'ping'], wrapSessionMethods)
    // shim.wrap(Object.getPrototypeOf(session), ['close', 'connect', 'error', 'frameError', 'goaway', 'localSettings', 'ping', 'remoteSettings', 'stream', 'timeout'], wrapSessionEvents)
    // shim.wrap(Object.getPrototypeOf(session), ['close', 'error', 'frameError', 'goaway', 'stream', 'timeout'], wrapSessionEvents)
  }

  // Will be removed if we don't end up needing them:
  // function wrapSessionMethods(shim, fn, fnName) {
  //   return function wrappedMethods(...args) {
  //     if (!shim.getActiveSegment()) {
  //       return fn.apply(this, args)
  //     }
  //     console.log('session method', fnName)
  //     const cbIndex = args.length - 1
  //     shim.bindSegment(args, cbIndex)
  //     return fn.apply(this, args)
  //   }
  // }

  // Will be removed if we don't need event listeners
  // function wrapSessionEvents(shim, fn, fnName) {
  //   return function wrappedSessionEvents(...args) {
  //     console.log('wrappedSessionEvents fnName', fnName)
  //     console.log('wrappedSessionEvents args', args)
  //
  //     const context = shim.tracer.getContext()
  //     const segment = shim.getActiveSegment()
  //     const emit = this.emit
  //     const newContext = context.enterSegment({ segment })
  //     const boundEmit = shim._agent.tracer.bindFunction(emit, newContext)
  //
  //     // if (!segment || !emit) {
  //     //   return fn.apply(this, args)
  //     // }
  //     this.emit = wrappedEmit
  //
  //     return fn.apply(this, args)
  //
  //     function wrappedEmit(event, arg) {
  //       const transaction = agent.tracer.getTransaction()
  //       console.log('wrapped emit event', event)
  //
  //       if ((event === 'error' || event === 'frameError' || event === 'goaway') && arg && arg > 0) {
  //         segment.end()
  //         handleError({ transaction, req: fn, error: arg })
  //       }
  //       if (event === 'close') {
  //         console.log('we are closing the connection', arg)
  //       }
  //
  //       return boundEmit.apply(this, arguments)
  //     }
  //   }
  // }

  function wrapRequest(shim, fn) {
    return function wrappedRequest(...args) {
      // .request returns a stream; this too will need to be wrapped for streaming connections
      const txn = shim._agent.tracer.getTransaction()
      if (!txn) {
        return fn.apply(this, args)
      }
      const http2ConnectUrl = txn.trace.custom.attributes['http2ConnectUrl'].value

      const segment = shim.getActiveSegment()
      const context = this

      // extract protocol from the connect argument...but we could get port, too.
      const { protocol, port, hostname } = new URL(http2ConnectUrl)

      // args to this function are request headers.
      // collect host, port, and path from the args[0] object
      const host = args[0][':authority'] // host and port
      const path = args[0][':path']
      const method = args[0][':method']

      const name = NAMES.EXTERNAL.PREFIX + host + path

      const argArray = { shim, segment, args, fn, protocol, host, port, hostname, path, method }

      return agent.tracer.addSegment(
        name,
        recordExternal(host, 'http2'),
        segment,
        false,
        doRequest.bind(context, argArray) // request may already be done by this point
      )
    }
  }

  /**
   * Records external attributes and then performs the http2 request
   *
   * @param {object} params to function
   * @param {object} params.segment
   * @param {Array} params.args Arguments to the function to be invoked
   * @param {function} params.fn The function making the request; likely ClientHttp2Session.request()
   * @param {string} params.protocol `https` or `http`, recorded from the .connect request
   * @param {string} params.host Address of the remote host receiving the request, derived from URL
   * @param {number} params.port Port of the request, derived from URL
   * @param {string} params.hostname Human-readable host name, derived from URL
   * @param {string} params.path Request path, derived from URL
   * @param {string} params.method HTTP method of the request
   * @returns {stream} The return value of the .request() function
   */

  function doRequest({ segment, args, fn, protocol, host, port, hostname, path, method }) {
    if (!segment) {
      return fn.apply(this, args)
    }
    segment.captureExternalAttributes({
      protocol,
      hostname,
      host,
      method,
      port,
      path
    })

    return fn.apply(this, args)
  }

  /**
   * Notices the given error if there is no listener for the `error` event on the
   * request object.
   *
   * @param {object} params to function
   * @param {Transaction} params.transaction active transaction
   * @param {object} params.req http2.ClientHttp2Session.request
   * @param {Error} params.error If provided, unhandled error that occurred during request
   * @param params.fn
   * @returns {boolean} True if the error will be collected by New Relic.
   */
  function handleError({ transaction, fn, error }) {
    logger.trace(error, 'Captured outbound error on behalf of the user.')
    transaction.agent.errors.add(transaction, error)
    return true
  }

  // /**
  //  * Ties the response object to the request segment.
  //  *
  //  * @param {object} params to function
  //  * @param {Agent} params.agent agent instance
  //  * @param {TraceSegment} params.segment active segment
  //  * @param {Transaction} params.transaction active transaction
  //  * @param {object} params.res http.ServerResponse
  //  */
  // function handleResponse({ agent, segment, transaction, res }) {
  //   // Add response attributes for spans
  //   segment.addSpanAttribute('http.statusCode', res.statusCode)
  //   segment.addSpanAttribute('http.statusText', res.statusMessage)
  // }
}
