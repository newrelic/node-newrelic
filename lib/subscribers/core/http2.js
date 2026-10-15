/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { isIPv6 } = require('node:net')
const BaseCoreSubscriber = require('./base')
const { wrapMethod } = require('../wrap-method')
const NAMES = require('#agentlib/metrics/names.js')
const recordExternal = require('#agentlib/metrics/recorders/http_external.js')
const synthetics = require('#agentlib/synthetics.js')
const { undiciConnection } = require('#agentlib/symbols.js')
const urltils = require('#agentlib/util/urltils.js')

const instrumentedMethods = ['request']

/**
 * Wraps an IPv6 host in brackets so the origin can be parsed as a URL. Node
 * builds the stream's origin from the bare host, e.g. `http://::1:8443`, which
 * `URL` rejects.
 *
 * @param {string} origin The stream's origin, in the form `<protocol>//<host>:<port>`.
 * @returns {string} The origin with its host bracketed if it is an IPv6 address,
 * otherwise the origin unchanged.
 */
function bracketIPv6Origin(origin) {
  const match = /^([^/]+\/\/)(.+):(\d+)$/.exec(origin)
  if (!match || !isIPv6(match[2])) {
    return origin
  }
  const [, scheme, host, port] = match
  return `${scheme}[${host}]:${port}`
}

module.exports = class Http2ClientSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'http2', instrumentedMethods })
  }

  /**
   * Creates the external segment and injects the outbound tracing headers
   * before `session.request()` runs. The returned context is the one `end`
   * runs in.
   *
   * @param {object} data Event data published to the `start` event.
   * @param {object|Array} data.headers The outbound request headers.
   * @param {object} ctx The current async context.
   * @returns {object} The updated context with the external segment, or the
   * original context when the parent segment is opaque.
   */
  handler(data, ctx) {
    if (ctx.segment?.opaque) {
      this.logger.trace('Not recording http2 external, parent segment is opaque')
      return ctx
    }

    // temporarily set segment name, will fill it in later as we know more
    const newCtx = this.createSegment({ name: NAMES.EXTERNAL.PREFIX, ctx })
    this.#addDTHeaders({
      transaction: ctx.transaction,
      segment: newCtx.segment,
      config: this.config,
      headers: data.headers
    })
    return newCtx
  }

  /**
   * Names the external segment and instruments the returned stream once
   * `session.request()` has returned a `ClientHttp2Stream`. Runs in the context
   * `handler` returned, so the active segment is the external segment, or the
   * opaque parent when `handler` skipped creating one.
   *
   * @param {object} data Event data published to the `end` event.
   * @param {object} [data.result] The `ClientHttp2Stream` returned from `request()`.
   * @param {object|Array} data.headers The outbound request headers.
   */
  end(data) {
    const { result: stream, headers } = data
    const ctx = this.agent.tracer.getContext()
    const { transaction, segment } = ctx
    if (!transaction?.isActive() || !stream || segment?.opaque) {
      this.logger.trace('Not recording http2 external, transaction is not active, parent segment is opaque, or no stream was returned')
      return
    }

    const externalAttrs = this.#extractExternalAttrs({ stream, config: this.config, headers })
    segment.name = NAMES.EXTERNAL.PREFIX + externalAttrs.host + externalAttrs.path
    segment.captureExternalAttributes(externalAttrs)
    // registered here, instead of on createSegment, because the accurate host
    // isn't known until after extractExternalAttrs refines it from the stream
    transaction.addRecorder(recordExternal(externalAttrs.host, 'http2').bind(null, segment))
    this.#instrumentStream(stream, segment, transaction)
  }

  instrument(http2) {
    const self = this

    // Wraps the http2 connect method so each session's request method can be
    // wrapped. No segment is created for connect, so it does not publish to a
    // tracing channel.
    wrapMethod({
      module: http2,
      methodName: 'connect',
      logger: this.logger,
      wrapper: function wrapConnect(original) {
        return function wrappedConnect(...args) {
          const session = original.apply(this, args)
          if (session.socket?.[undiciConnection]) {
            self.logger.trace('Not instrumenting http2 session.request; connection already instrumented by undici instrumentation')
            return session
          }
          self.#wrapRequest(session)
          return session
        }
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
    // the base class builds one channel per entry in `instrumentedMethods`
    const [channel] = this.channels

    wrapMethod({
      module: session,
      methodName: 'request',
      logger: this.logger,
      wrapper: function wrapRequest(original) {
        return function wrappedRequest(...args) {
          // `handler` adds the tracing headers to this object in place, so make
          // sure there is one when request() is called without headers
          args[0] ??= {}
          const data = { headers: args[0] }
          return channel.traceSync(original, data, this, ...args)
        }
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
   * @param {Transaction} transaction the transaction the request belongs to
   */
  #instrumentStream(stream, segment, transaction) {
    const self = this
    const { agent } = self
    wrapMethod({
      module: stream,
      methodName: 'emit',
      logger: this.logger,
      wrapper: function wrapStreamEmit(original) {
        // called from `end`, which runs in the context `handler` entered, so the
        // external segment is already the active segment
        const context = agent.tracer.getContext()

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
          return agent.tracer.runInContext({ handler: original, context, full: false, thisArg: this, args: arguments })
        }
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
   * Extracts the path and method from the session.request headers and the
   * authority from the stream. It then constructs a URL and parses, obfuscates,
   * and scrubs it and returns the necessary keys to capture it as an external
   * web request
   *
   * @param {object} params to function
   * @param {object} params.config agent config
   * @param {object|Array} params.headers request headers
   * @param {object} params.stream the ClientHttp2Stream, which holds the authority
   * (protocol + host + port) under Node's internal `Symbol(origin)`
   * @returns {object} externalAttrs with protocol, hostname, host, method, port, path, queryParams
   */
  #extractExternalAttrs({ config, headers, stream }) {
    // the stream's origin is built by `http2.connect()` from any form of
    // authority it accepts (string, URL, or options object), and honors `servername`
    const originSymbol = Object.getOwnPropertySymbols(stream).find((symbol) => symbol.toString() === 'Symbol(origin)')
    const authority = bracketIPv6Origin(stream[originSymbol])

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
      // the raw :path has not been scrubbed, so drop its query string, fragment,
      // and matrix parameters before it can reach the segment name or span
      const [path] = String(externalAttrs.path).split(/[?#;]/)
      externalAttrs.path = urltils.obfuscatePath(config, path || '/')
    }

    if (parsedUrl) {
      externalAttrs.host = parsedUrl.host
      externalAttrs.hostname = parsedUrl.hostname
      externalAttrs.protocol = parsedUrl.protocol
      // URL drops the port when it is the protocol's default, leaving ''
      const defaultPort = parsedUrl.protocol === 'http:' ? 80 : 443
      externalAttrs.port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : defaultPort
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
