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
  const http2ConnectUrl = Symbol('http2ConnectUrl')

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
      const session = fn.apply(this, args)
      session[http2ConnectUrl] = args[0]
      return shim.wrap(session, ['request'], wrapRequest)
    }
  }

  /**
   * Wraps the request and creates an external segment for it
   *
   * @param {object} shim shim passed in from wrapSession
   * @param {Function} fn the http2 request returned from .connect()
   * @returns {Function} wrapped request function, which returns a ClientHttp2Stream
   */
  function wrapRequest(shim, fn) {
    return function wrappedRequest(...args) {
      const txn = agent.tracer.getTransaction()
      if (!txn) {
        logger.trace('Not in a transaction; not recording http2 external')
        return fn.apply(this, args)
      }
      const activeSegment = shim.getActiveSegment()

      // args[0] is request headers.
      const [headers = {}] = args
      // The :authority header of .request() does not contain protocol,
      // but we've saved the full url during .connect()
      const { protocol } = new URL(this[http2ConnectUrl])

      // The connectUrl doesn't have path or query params, so for recording, we add them back.
      let parsedUrl
      try {
        parsedUrl = new URL(`${protocol}//${headers[':authority']}${headers[':path']}`)
      } catch (err) {
        logger.error(`Unable to parse URL ${protocol}//${headers[':authority']}${headers[':path']}`, err)
      }

      // Some poorly defined URLs won't result in an error, but return from URL undefined
      // This returns either case without further processing
      if (!parsedUrl) {
        return fn.apply(this, args)
      }

      const { port, host, hostname } = parsedUrl
      const scrubbedUrl = urltils.scrubAndParseParameters(parsedUrl) // to get parameters in the format we want
      const path = urltils.obfuscatePath(agent.config, scrubbedUrl.path)
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

        const stream = fn.apply(this, args)
        return shim.wrap(stream, 'emit', wrapStreamEmit)
      }
    }
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
        } else if (event === 'response') {
          handleResponse({ agent, shim, segment, stream: ctx, response: arg })
        }
        if (isErrorEvent || event === 'end') {
          segment.end()
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
  if (stream?.listenerCount('error') > 0) {
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
 * Injects relevant tracing headers for the external request
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
