/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NAMES = require('../../metrics/names')
const recordExternal = require('../../metrics/recorders/http_external')
const logger = require('../../logger').child({ component: 'http2' })
const synthetics = require('../../synthetics')
const urltils = require('../../util/urltils.js')
const cat = require('#agentlib/util/cat.js')
module.exports = initialize

function initialize(agent, http2, moduleName, shim) {
  shim.wrap(http2, 'connect', wrapConnect)
  shim.wrapReturn(http2, 'connect', wrapSession)
  const moduleCtx = this

  /**
   * Wraps the http2 connect method in instrumentation, and saves the connect URL.
   * The .request() method's argument doesn't retain the protocol of the connection,
   * but it's available here as arg[0]
   *
   * @param {object} shim the generic shim with which the agent instruments
   * @param {Function} fn the original connect function
   * @returns {Function} an instrumented connect function
   */
  function wrapConnect(shim, fn) {
    return function wrappedConnect(...args) {
      moduleCtx.http2ConnectUrl = args[0]
      return fn.apply(this, args)
    }
  }

  /**
   * Wraps the ClientHttp2Session returned by http2.connect()
   *
   * @param {object} shim the generic shim with which the agent instruments
   * @param {Function} fn the original connect function
   * @param {String} fnName name of the connect function
   * @param {EventEmitter} session the newly created ClientHttp2Session
   */
  function wrapSession(shim, fn, fnName, session) {
    shim.wrap(session, ['request'], wrapRequest)
    shim.wrapReturn(session, ['request'], wrapStream)
  }

  /**
   * Wraps the request and creates an external segment for it
   *
   * @param {object} shim shim passed in from wrapSession
   * @param {function} fn the http2 request returned from .connect()
   * @returns {function} wrapped request function, which returns a ClientHttp2Stream
   */
  function wrapRequest(shim, fn) {
    return function wrappedRequest(...args) {
      const txn = agent.tracer.getTransaction()
      if (!txn) {
        logger.trace('Not in a transaction; not recording http2 external')
        return fn.apply(this, args)
      }
      const activeSegment = shim.getActiveSegment()

      const { http2ConnectUrl } = moduleCtx

      // args[0] is request headers.
      const [headers = {}] = args
      // The :authority header of .request() does not contain protocol,
      // but we've saved that during .connect()
      // The connectUrl doesn't have path or query params, so for recording, we add them back.
      const parsedUrl = new URL(`${http2ConnectUrl}${headers[':path']}`)
      const { protocol, port, host, hostname, pathname } = parsedUrl

      const scrubbedUrl = urltils.scrubAndParseParameters(parsedUrl) // to get parameters in the format we want
      const path = urltils.obfuscatePath(agent.config, pathname)
      const method = headers[':method']
      const name = NAMES.EXTERNAL.PREFIX + host + path

      const segment = shim.createSegment({
        name,
        recorder: recordExternal(host, 'http2'),
        parent: activeSegment
      })
      segment.start()

      return shim.applySegment(makeRequest, segment, true, this, args)

      function makeRequest() {
        args[0] = addDTHeaders({
          transaction: agent.tracer.getTransaction(),
          config: agent.config,
          headers
        })

        segment.captureExternalAttributes({
          protocol,
          hostname,
          host,
          method,
          port,
          path,
          queryParams: scrubbedUrl?.parameters
        })

        return fn.apply(this, args)
      }
    }
  }

  /**
   * Wraps the ClientHttp2Stream, returned from session.request()
   *
   * @param {object} shim the generic shim with which the agent instruments
   * @param {Function} fn the original .request function
   * @param {String} fnName name of the request function
   * @param {EventEmitter} stream the current ClientHttp2Stream returned from session.request()
   */
  function wrapStream(shim, fn, fnName, stream) {
    shim.wrap(stream, 'emit', wrapStreamEmit)
  }

  /**
   * Wraps the ClientHttp2Stream to listen for response/header or for errors.
   * Of the events emitted by Http2Stream, we're interested in 'error', 'frameError', and 'timeout'
   * Of the events emitted by ClientHttp2Stream, we're interested in 'response', to get headers
   *
   * @param {object} shim shim passed in from wrapStream
   * @param {function} fn the ClientHttp2Stream returned from .request()
   * @returns {function} ClientHttp2Stream, with wrapped emit
   */
  function wrapStreamEmit(shim, fn) {
    return function wrappedStreamEmit(...args) {
      const ctx = this
      const transaction = agent.tracer.getTransaction()
      const context = agent.tracer.getContext()
      const segment = shim.getActiveSegment(ctx)
      const emit = this.emit
      const newContext = context.enterSegment({ segment })
      const boundEmit = agent.tracer.bindFunction(emit, newContext)

      if (!segment || !emit) {
        return fn.apply(this, args)
      }
      this.emit = wrappedEmit

      return fn.apply(this, args)

      function wrappedEmit(event, arg) {
        const isErrorEvent = ['error', 'frameError', 'timeout'].indexOf(event) > -1
        if (isErrorEvent) {
          handleError({ transaction, req: ctx, arg }) // req is the ClientHttp2Stream
          segment.end()
        } else if (event === 'response') {
          handleResponse({ agent, shim, segment, stream: ctx, response: arg })
        }
        return boundEmit.apply(this, arguments)
      }
    }
  }
}

/**
 * Notices the given error if there is no listener for the `error` event on the
 * request object.
 *
 * @param {object} params to function
 * @param {Transaction} params.transaction active transaction
 * @param {object} params.stream wrapped ClientHttp2Stream, the closest analog of request
 * @param {Error} params.error If provided, unhandled error that occurred during request
 * @returns {boolean} True if the error will be collected by New Relic.
 */
function handleError({ transaction, stream, error }) {
  if (stream.listenerCount('error') > 0) {
    logger.trace(error, 'Not capturing outbound error because user has already handled it.')
    return false
  }

  logger.trace(error, 'Captured outbound error on behalf of the user.')
  transaction.agent.errors.add(transaction, error)
  return true
}

/**
 * Ties the ClientHttp2Stream response to the session.request() segment.
 *
 * @param {object} params to function
 * @param {Agent} params.agent agent instance
 * @param {Object} params.shim shim passed in from wrapStreamEmit
 * @param {object} params.stream ClientHttp2Stream response, passed in for its rsponse emit to be wrapped
 * @param {object} params.response ClientHttp2Stream response header
 */
function handleResponse({ agent, shim, stream, response }) {
  // Add response attributes for spans
  const status = response ? response[':status'] : null
  const statusHeader = 'http.statusCode'
  const segment = shim.getActiveSegment()
  segment.addSpanAttribute(statusHeader, status)

  // Again a custom emit wrapper because we want to watch for the `end` event.
  shim.wrap(stream, 'response', 'emit', function wrapEmit(emit) {
    const context = agent.tracer.getContext()
    const newContext = context.enterSegment({ segment })
    const boundEmit = agent.tracer.bindFunction(emit, newContext)
    return function wrappedResponseEmit(evnt) {
      if (evnt === 'end') {
        segment.end()
      }
      return boundEmit.apply(this, arguments)
    }
  })
}

/**
 * Injects relevant DT headers for the external request
 *
 * @param {object} params object to fn
 * @param {Shim} params.transaction current transaction
 * @param {object} params.headers outbound ClientHttp2Session request headers
 * @param {object} params.config agent config
 * @returns {object} headers with DT inserted, if enabled, or the original headers
 */
function addDTHeaders({ transaction, config, headers }) {
  const outboundHeaders = Object.create(null)
  synthetics.assignHeadersToOutgoingRequest(config, transaction, outboundHeaders)

  if (config.distributed_tracing.enabled) {
    transaction.insertDistributedTraceHeaders(outboundHeaders)
  } else if (config.cross_application_tracer.enabled) {
    cat.addCatHeaders(config, transaction, outboundHeaders)
  } else {
    logger.trace('Both DT and CAT are disabled, not adding headers!')
  }

  for (const key in outboundHeaders) {
    headers[key] = outboundHeaders[key]
  }
  return headers
}
