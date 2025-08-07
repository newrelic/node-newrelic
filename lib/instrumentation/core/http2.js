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
  let http2ConnectAuthority = ''

  function wrapConnect(shim, fn) {
    return function wrappedConnect(...args) {
      const context = this
      http2ConnectAuthority = args[0] // caching this as a fallback for streaming use
      return http2ConnectInstrumentation(shim, args, function makeConnection(args) {
        const txn = shim._agent.tracer.getTransaction()
        // no transaction yet for InvokeModelWithResponseStreamCommand 
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
    // shim.wrap(Object.getPrototypeOf(session), ['error', 'close', 'frameError', 'goaway'], wrapSessionEvents)

    // wrapping the return value of request this way blocks instrumentation
    // But...the return value of request is our access to ClientHttp2Stream
    // shim.wrapReturn(session, ['request'], wrapStreamWithSomeWrapper) // for streaming sessions
  }

  // Will be removed if we don't end up needing them:
  // function wrapSessionMethods(shim, fn) {
  //   return function wrappedMethods(...args) {
  //     if (!shim.getActiveSegment()) {
  //       return fn.apply(this, args)
  //     }
  //     const cbIndex = args.length - 1
  //     shim.bindSegment(args, cbIndex)
  //     return fn.apply(this, args)
  //   }
  // }

  // Will be removed if we don't need event listeners
  // function wrapSessionEvents(shim, fn) {
  //   return function wrappedSessionEvents(...args) {
  //     const context = shim.tracer.getContext()
  //     const segment = shim.getActiveSegment()
  //     const emit = this.emit
  //     const newContext = context.enterSegment({ segment })
  //     const boundEmit = shim._agent.tracer.bindFunction(emit, newContext)
  //
  //     if (!segment || !emit) {
  //       return fn.apply(this, args)
  //     }
  //     this.emit = wrappedEmit
  //
  //     return fn.apply(this, args)
  //
  //     function wrappedEmit(event, arg) {
  //       const transaction = agent.tracer.getTransaction()
  //       if ((event === 'error' || event === 'frameError' || event === 'goaway') && arg && arg > 0) {
  //         segment.end()
  //         handleError({ transaction, req: fn, error: arg })
  //       }
  //
  //       return boundEmit.apply(this, arguments)
  //     }
  //   }
  // }

  function wrapRequest(shim, fn) {
    return function wrappedRequest(...args) {
      // .request returns a stream; this too will need to be wrapped for streaming connections

      let http2ConnectUrl
      const txn = shim._agent.tracer.getTransaction()
      if (txn) {
        http2ConnectUrl = txn.trace.custom.attributes['http2ConnectUrl'].value
      } else {
        http2ConnectUrl = http2ConnectAuthority
      }

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

  /**
   * Ties the response object to the request segment.
   *
   * @param {object} params to function
   * @param {Agent} params.agent agent instance
   * @param {TraceSegment} params.segment active segment
   * @param {Transaction} params.transaction active transaction
   * @param {object} params.res http.ServerResponse
   */
  function handleResponse({ agent, segment, transaction, res }) {
    // Add response attributes for spans
    segment.addSpanAttribute('http.statusCode', res.statusCode)
    segment.addSpanAttribute('http.statusText', res.statusMessage)
  }
}
