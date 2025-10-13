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
   * @param {object} shim shim passed in from wrapConnect
   * @param {Function} fn the ClientHttp2Session returned from .connect()
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
      const { method, protocol, host, hostname, port, path, queryParams } = extractExternalAttrs(agent.config, headers, this[http2ConnectUrl])

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
          queryParams
        })

        const stream = fn.apply(this, args)
        shim.wrap(stream, ['response', 'close', 'end', 'error', 'frameError', 'timeout'], wrapStreamEmit)
        return stream
      }
    }
  }

  /**
   * Wraps the ClientHttp2Stream to listen for response/header or for errors.
   * Of the events emitted by Http2Stream, we're interested in 'error', 'frameError', and 'timeout'
   * Of the events emitted by ClientHttp2Stream, we're interested in 'response', to get headers
   *
   * @param {object} shim shim passed in from wrapStream
   * @param {Function} fn the ClientHttp2Stream returned from .request()
   * @returns {Function} ClientHttp2Stream, with wrapped emit
   */
  function wrapStreamEmit(shim, fn) {
    return function wrappedStreamEmit(...args) {
      const clientStream = this
      const transaction = agent.tracer.getTransaction()
      const context = agent.tracer.getContext()
      const segment = shim.getActiveSegment(clientStream)
      const emit = this.emit

      if (!segment || !emit) {
        return fn.apply(this, args)
      }

      const newContext = context.enterSegment({ segment })
      const boundEmit = agent.tracer.bindFunction(emit, newContext)

      this.emit = wrappedEmit

      return fn.apply(this, args)

      function wrappedEmit(event, arg) {
        const isErrorEvent = ['error', 'frameError', 'timeout'].indexOf(event) > -1
        if (isErrorEvent) {
          handleError({ transaction, stream: clientStream, error: arg })
        } else if (event === 'response') {
          handleResponse({ shim, segment, response: arg })
        }
        if (isErrorEvent || event === 'end' || event === 'close') {
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
    logger.trace(error, 'Not capturing http2 client error because user has already handled it.')
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
 * @param {object} params.shim shim passed in from wrapStreamEmit
 * @param {object} params.response ClientHttp2Stream response header
 */
function handleResponse({ shim, response }) {
  // Add response attributes for spans
  const status = response ? response[':status'] : null
  const statusHeader = 'http.statusCode'
  const segment = shim.getActiveSegment()
  segment.addSpanAttribute(statusHeader, status)
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

/**
 * Derives external segment properties from request headers with the connect URL as a fallback
 * Headers can be an object or can be raw
 *
 * @param {object} config The current agent config
 * @param {object} requestHeaders object or flat array containing request headers
 * @param {string} connectUrl URL used in http2.connect()
 * @returns {object} consisting of URL attributes for our external segment
 */
function extractExternalAttrs(config, requestHeaders, connectUrl) {
  let headers = {}
  if (Array.isArray(requestHeaders)) {
    // objectify raw headers
    for (let i = 0; i < requestHeaders.length; i = i + 2) {
      headers[requestHeaders[i]] = requestHeaders[i + 1]
    }
  } else {
    headers = { ...requestHeaders }
  }

  // prefer getting URL components from the headers, but fall back to the connect arg when we don't have them
  // The :authority header of .request() does not contain protocol,
  // but we've saved the full url during .connect()
  const {
    protocol: connectProtocol,
    host: connectHost,
    hostname: connectHostname,
    port: connectPort,
    pathname: connectPath,
    searchParams: connectSearchParams,
    search
  } = new URL(connectUrl)

  const protocol = headers[':scheme'] || headers[':protocol'] || connectProtocol || 'http:'
  const authority = headers[':authority'] || headers['host'] || connectHost || 'localhost'
  let path = headers[':path'] || `${connectPath}${search}` || '/'

  let parsedUrl
  try {
    parsedUrl = new URL(`${protocol}//${authority}${path}`)
  } catch (err) {
    logger.error(`Unable to parse URL ${protocol}//${authority}${headers[':path']}`, err)
  }

  // Some poorly defined URLs won't result in an error, but return from URL undefined
  // This sets defaults so we can continue instrumenting
  let port = connectPort
  let host = connectHost
  let hostname = connectHostname
  let queryParams = connectSearchParams

  if (parsedUrl) {
    host = parsedUrl.host
    hostname = parsedUrl.hostname
    port = parsedUrl.port
    const scrubbedUrl = urltils.scrubAndParseParameters(parsedUrl) // to get parameters in the format we want
    path = urltils.obfuscatePath(config, scrubbedUrl.path)
    queryParams = scrubbedUrl?.parameters
  }

  const method = headers[':method'] || 'GET'
  return { method, protocol, host, hostname, port, path, queryParams }
}
