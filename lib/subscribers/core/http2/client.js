/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseCoreSubscriber = require('../base')
const shimmer = require('#agentlib/shimmer.js')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')
const NAMES = require('#agentlib/metrics/names.js')
const http2ConnectUrl = Symbol('http2ConnectUrl')
const recordExternal = require('#agentlib/metrics/recorders/http_external.js')
const synthetics = require('#agentlib/synthetics.js')
const { undiciConnection } = require('#agentlib/symbols.js')
const urltils = require('#agentlib/util/urltils.js')

const REQUEST = 'request'
const instrumentedMethods = [REQUEST]

module.exports = class Http2ClientSubscriber extends BaseCoreSubscriber {
  #requestChannel

  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'http2', instrumentedMethods })
    // `request` is wrapped per session, so build its channel once up front
    this.#requestChannel = tracingChannel(`${this.id}:${REQUEST}`)
  }

  /**
   * Creates the external segment and injects the outbound tracing headers
   * before `session.request()` runs. The segment is stashed on `data` so that
   * `end` only finishes a segment this handler actually created.
   *
   * @param {object} data Event data published to the `start` event.
   * @param {object|Array} data.headers The outbound request headers.
   * @param {object} ctx The current async context.
   * @returns {object} The updated context with the external segment, or the
   * original context when no segment was created.
   */
  handler(data, ctx) {
    if (ctx.segment?.opaque) {
      this.logger.trace('Not recording http2 external, parent segment is opaque')
      return ctx
    }

    // temporarily set segment name, will fill it in later as we know more
    const newCtx = this.createSegment({ name: NAMES.EXTERNAL.PREFIX, ctx })
    if (newCtx === ctx) {
      return ctx
    }

    data.segment = newCtx.segment
    data.transaction = ctx.transaction
    this.#addDTHeaders({
      transaction: data.transaction,
      segment: data.segment,
      config: this.config,
      headers: data.headers
    })
    return newCtx
  }

  /**
   * Names the external segment and instruments the returned stream once
   * `session.request()` has returned a `ClientHttp2Stream`.
   *
   * @param {object} data Event data published to the `end` event.
   * @param {TraceSegment} [data.segment] The segment created by `handler`, if any.
   * @param {Transaction} [data.transaction] The active transaction.
   * @param {object} [data.result] The `ClientHttp2Stream` returned from `request()`.
   * @param {object|Array} data.headers The outbound request headers.
   * @param {string} data.authority The URL passed to `http2.connect()`.
   */
  end(data) {
    const { segment, transaction, result: stream, headers, authority } = data
    if (!segment || !stream) {
      return
    }

    const externalAttrs = this.#extractExternalAttrs({ stream, config: this.config, headers, authority })
    segment.name = NAMES.EXTERNAL.PREFIX + externalAttrs.host + externalAttrs.path
    segment.captureExternalAttributes(externalAttrs)
    // registered here, instead of on createSegment, because the accurate host
    // isn't known until after extractExternalAttrs refines it from the stream
    transaction.addRecorder(recordExternal(externalAttrs.host, 'http2').bind(null, segment))
    this.#instrumentStream(stream, segment)
  }

  instrument(http2) {
    const self = this

    // Wraps the http2 connect method in instrumentation, and saves the connect URL.
    // The .request() method's argument doesn't retain the protocol of the connection,
    // but it's available here as arg[0]. No segment is created for connect, so it
    // does not publish to a tracing channel.
    shimmer.wrapMethod(http2, 'http2', 'connect', function wrapConnect(original) {
      return function wrappedConnect(...args) {
        const session = original.apply(this, args)
        if (session.socket?.[undiciConnection]) {
          self.logger.trace('Not instrumenting http2 session.request; connection already instrumented by undici instrumentation')
          return session
        }
        session[http2ConnectUrl] = args[0]
        self.#wrapRequest(session)
        return session
      }
    })
  }

  /**
   * Wraps the session's request method to publish to the `request` tracing
   * channel, where `handler` and `end` create the external segment for it.
   *
   * @param {object} session The ClientHttp2Session returned from `http2.connect()`.
   */
  #wrapRequest(session) {
    const channel = this.#requestChannel

    shimmer.wrapMethod(session, 'http2', REQUEST, function wrapRequest(original) {
      return function wrappedRequest(...args) {
        // `handler` adds the tracing headers to this object in place, so make
        // sure there is one when request() is called without headers
        args[0] ??= {}
        const data = { headers: args[0], authority: this[http2ConnectUrl] }
        return channel.traceSync(original, data, this, ...args)
      }
    })
  }

  /**
   * Wraps the ClientHttp2Stream to listen for response/header or for errors.
   * Of the events emitted by Http2Stream, we're interested in 'error', 'frameError', and 'timeout'
   * Of the events emitted by ClientHttp2Stream, we're interested in 'response', to get headers
   *
   * @param {object} stream the ClientHttp2Stream returned from .request()
   * @param {Segment} segment the external segment created for this request
   */
  #instrumentStream(stream, segment) {
    const self = this
    const { agent } = self
    shimmer.wrapMethod(stream, 'http2', 'emit', function wrapStreamEmit(original) {
      const context = agent.tracer.getContext()
      const transaction = agent.tracer.getTransaction()
      const newContext = context.enterSegment({ segment })

      return function wrappedEmit(event, arg) {
        const isErrorEvent = ['error', 'frameError', 'timeout'].indexOf(event) > -1
        if (isErrorEvent) {
          self.#handleError({ transaction, stream: this, error: arg })
        } else if (event === 'response') {
          self.#handleResponse({ segment, response: arg })
        }
        if (isErrorEvent || event === 'end' || event === 'close') {
          segment.touch()
        }
        return agent.tracer.runInContext({ handler: original, context: newContext, full: false, thisArg: this, args: arguments })
      }
    })
  }

  /**
   * Notices the given error if there is no listener for the `error` event on the
   * request object.
   *
   * @param {object} params to function
   * @param {Transaction} params.transaction active transaction
   * @param {object} params.stream wrapped ClientHttp2Stream, the closest analog of request
   * @param {Error} params.error If provided, unhandled error that occurred during request
   * @returns {void}
   */
  #handleError({ transaction, stream, error }) {
    const { logger } = this
    if (stream?.listenerCount('error') > 0) {
      logger.trace(error, 'Not capturing http2 client error because user has already handled it.')
      return
    }

    logger.trace(error, 'Captured outbound error on behalf of the user.')
    transaction.agent.errors.add(transaction, error)
  }

  /**
   * Ties the ClientHttp2Stream response to the session.request() segment.
   *
   * @param {object} params to function
   * @param {object} params.response ClientHttp2Stream response header
   * @param {TraceSegment} params.segment external segment created for this request
   */
  #handleResponse({ segment, response }) {
  // Add response attributes for spans
    const status = response?.[':status']
    const statusHeader = 'http.statusCode'
    segment.addSpanAttribute(statusHeader, status)
  }

  /**
   * Extracts the authority, path, method from the session.request headers
   * It then constructs a URL and parses, obfuscates, and scrubs it
   * and returns the necessary keys to capture it as an external web request
   *
   * @param {object} params to function
   * @param {object} params.config agent config
   * @param {object|Array} params.headers request headers
   * @param {string} params.authority the authority (protocol + host + port) from the session.connect
   * @param {object} params.stream the ClientHttp2Stream, used to refine the authority
   * @returns {object} externalAttrs with protocol, hostname, host, method, port, path, queryParams
   */
  #extractExternalAttrs({ config, headers, authority, stream }) {
    for (const symbol of Object.getOwnPropertySymbols(stream)) {
      if (symbol.toString() === 'Symbol(origin)') {
        authority = stream[symbol]
      }
    }

    const externalAttrs = {
      protocol: 'https:',
      hostname: null,
      host: 'unknown',
      method: 'GET',
      port: 443,
      path: '/',
      queryParams: {},
    }

    this.#parseAttrsFromHeaders(headers, externalAttrs)

    let parsedUrl
    try {
      parsedUrl = new URL(`${authority}${externalAttrs.path}`)
    } catch (err) {
      this.logger.trace('Could not parse URL from request headers: %s', err.message)
    }

    if (parsedUrl) {
      externalAttrs.host = parsedUrl.host
      externalAttrs.hostname = parsedUrl.hostname
      externalAttrs.port = parseInt(parsedUrl.port, 10)
      externalAttrs.protocol = parsedUrl.protocol
      const scrubbedUrl = urltils.scrubAndParseParameters(parsedUrl) // to get parameters in the format we want
      externalAttrs.path = urltils.obfuscatePath(config, scrubbedUrl.path)
      externalAttrs.queryParams = scrubbedUrl?.parameters
    }

    return externalAttrs
  }

  /**
   * Injects relevant tracing headers for the external request
   *
   * @param {object} params object to fn
   * @param {Transaction} params.transaction current transaction
   * @param {TraceSegment} params.segment external segment created during outbound request
   * @param {object} params.headers outbound ClientHttp2Session request headers
   * @param {object} params.config agent config
   * @returns {object} headers with DT inserted, if enabled, or the original headers
   */
  #addDTHeaders({ transaction, config, headers, segment }) {
    const outboundHeaders = Object.create(null)
    synthetics.assignHeadersToOutgoingRequest(config, transaction, outboundHeaders)
    const traceFlags = transaction.isSampled() === true ? 1 : 0
    transaction.insertDistributedTraceHeaders(outboundHeaders, null, { traceId: transaction.traceId, spanId: segment.id, traceFlags })

    for (const key in outboundHeaders) {
      if (Array.isArray(headers)) {
        headers.push(key)
        headers.push(outboundHeaders[key])
      } else {
        headers[key] = outboundHeaders[key]
      }
    }
    return headers
  }

  /**
   * Parses out the :path and :method from the headers,
   * handle whether headers are raw (array) or object
   *
   * @param {object|Array} headers request headers
   * @param {object} externalAttrs object to populate with path and method
   */
  #parseAttrsFromHeaders(headers, externalAttrs) {
  // headers can be raw which are an array in the format of
  // [<key>, <value>, <key-2>, <value-2>]
  // attempt to extract `:path` and `:method` from raw headers
  // otherwise fallback to extracting from object
    if (Array.isArray(headers)) {
      for (let i = 0; i < headers.length; i += 2) {
        const header = headers[i]
        const value = headers[i + 1]
        if (header === ':path') {
          externalAttrs.path = value
        }

        if (header === ':method') {
          externalAttrs.method = value
        }
      }
    } else {
      if (headers[':path']) {
        externalAttrs.path = headers[':path']
      }

      if (headers[':method']) {
        externalAttrs.method = headers[':method']
      }
    }
  }
}
