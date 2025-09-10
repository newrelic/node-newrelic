/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NAMES = require('../../metrics/names')
const recordExternal = require('../../metrics/recorders/http_external')
const logger = require('../../logger').child({ component: 'http2' })
const headerAttributes = require('../../header-attributes')
// const headerProcessing = require('../../header-processing')
const urltils = require('../../util/urltils.js')
const { DESTINATIONS: DESTS } = require('../../config/attribute-filter.js')
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
   * @param {Function} makeConnection wrapped function that executes .connect()
   * @returns {EventEmitter} The ClientHttp2Session returned by .connect()
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
      const txn = shim._agent.tracer.getTransaction()
      if (!txn) {
        logger.trace('Not in a transaction; not recording http2 external')
        return fn.apply(this, args)
      }
      const activeSegment = shim.getActiveSegment()
      const context = this

      const http2ConnectUrl = txn.trace.custom.attributes['http2ConnectUrl'].value
      // args[0] is request headers.
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
      segment.start()
      txn.type = 'web'
      txn.baseSegment = segment

      // The :authority header of .request() does not contain protocol,
      // but we've saved that during .connect()
      // The connectUrl doesn't have path or query params, so for recording, we add them back.
      const parsedUrl = new URL(`${http2ConnectUrl}${path}`)
      const { protocol, port, hostname, pathname } = parsedUrl

      // the error tracer needs a URL for tracing, even though naming overwrites
      txn.parsedUrl = parsedUrl
      txn.url = urltils.obfuscatePath(agent.config, pathname)
      txn.verb = method

      // URL is sent as an agent attribute with transaction events
      txn.trace.attributes.addAttribute(
        DESTS.TRANS_EVENT | DESTS.ERROR_EVENT,
        'request.uri',
        txn.url
      )

      segment.addSpanAttribute('request.uri', txn.url)

      return shim.applySegment(makeRequest, segment, true, this, args)

      function makeRequest() {
        const originalMetadata = { ...args[0] }

        const outboundHeaders = Object.create(null)
        if (shim.agent.config.distributed_tracing.enabled) {
          txn.insertDistributedTraceHeaders(outboundHeaders)
        } else {
          shim.logger.debug('Distributed tracing disabled by instrumentation.')
        }
        Object.keys(originalMetadata).forEach((key) => {
          outboundHeaders[key] = originalMetadata[key]
        })

        // Make sure we're recording headers
        headerAttributes.collectRequestHeaders(outboundHeaders, txn)
        args[0] = outboundHeaders

        segment.addAttribute('component', 'http2')
        // captureExternalAttributes folds host into request.uri, but we'll want this in the response listener
        segment.addAttribute('host', host)
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
      const context = shim.tracer.getContext()
      const segment = shim.getActiveSegment(ctx)
      const emit = this.emit
      const newContext = context.enterSegment({ segment })
      const boundEmit = shim._agent.tracer.bindFunction(emit, newContext)

      if (!segment || !emit) {
        return fn.apply(this, args)
      }
      this.emit = wrappedEmit

      return fn.apply(this, args)

      function wrappedEmit(event, arg) {
        const isErrorEvent = ['error', 'frameError', 'timeout'].indexOf(event) > -1
        const config = shim._agent.config
        // This assumes http config for errors/ignore should also apply here
        const shouldRecord = config?.http?.record_errors &&
            !config?.http?.ignore_status_codes.includes(arg)
        if (isErrorEvent && shouldRecord) {
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
  const statusHeader = 'response.headers.status'
  const txn = shim.tracer.getTransaction()
  txn.trace.attributes.addAttribute(DESTS.TRANS_COMMON, statusHeader, status)
  const segment = txn.baseSegment // baseSegment has our external attributes
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
