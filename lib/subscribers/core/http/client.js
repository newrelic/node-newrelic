/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { URL } = require('node:url')
const BaseCoreSubscriber = require('../base')
const { wrapMethod, wrapMethods } = require('../../wrap-method')
const NAMES = require('#agentlib/metrics/names.js')
const recordExternal = require('#agentlib/metrics/recorders/http_external.js')
const symbols = require('#agentlib/symbols.js')
const synthetics = require('#agentlib/synthetics.js')
const urltils = require('#agentlib/util/urltils.js')
const {
  assignOutgoingHeaders,
  extractHostPort,
  extractHostPortViaProxy,
  parseRequest
} = require('./client-utils')

const instrumentedMethods = ['request']
// both publish to the `request` channel, as `get` is `request` plus `end()`
const requestMethods = ['request', 'get']

/**
 * Records outbound `http` requests. It wraps `request` and `get`, which
 * publish each request to the `nr:client:http:request` tracing channel. The
 * `client` prefix keeps its id distinct from the other `http` subscribers.
 * `HttpsClientSubscriber` reuses it for `https`.
 */
class HttpClientSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger, packageName = 'http' }) {
    super({ agent, logger, packageName, prefix: 'client', instrumentedMethods })
  }

  /**
   * The protocol of requests whose options do not specify one.
   * `HttpsClientSubscriber` overrides it with `https:`.
   *
   * @returns {string} The default protocol.
   */
  get defaultProtocol() {
    return 'http:'
  }

  /**
   * Creates the external segment and injects the outbound tracing headers
   * before the request is made. The returned context is the one the request,
   * and `end`, run in.
   *
   * @param {object} data Event data published to the `start` event.
   * @param {object} data.options The normalized HTTP request options.
   * @param {object} ctx The current async context.
   * @returns {object} The updated context with the external segment, or the
   * original context when no segment is created.
   */
  handler(data, ctx) {
    const { options } = data
    const { host, hostname, port } = extractHostPortViaProxy(options) ?? extractHostPort(options, this.defaultProtocol)

    if (!hostname || port < 1) {
      this.logger.warn('Invalid host name (%s) or port (%s) for outbound request.', hostname, port)
      return ctx
    }

    const name = NAMES.EXTERNAL.PREFIX + host
    if (ctx.segment?.opaque) {
      this.logger.trace(
        'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
        name,
        ctx.segment.name
      )
      return ctx
    }

    const newCtx = this.createSegment({ name, recorder: recordExternal(host, 'http'), ctx })
    data.segment = newCtx.segment
    data.host = host
    data.hostname = hostname
    data.port = port

    // `newCtx` does not become active until this handler returns, so run in it
    // to have the tracing headers reference the external segment
    this.agent.tracer.runInContext({
      context: newCtx,
      handler: () => this.#addOutboundHeaders(ctx.transaction, options)
    })
    return newCtx
  }

  /**
   * Names the external segment, captures its attributes, and instruments the
   * returned request to handle its response. Runs in the context `handler`
   * returned.
   *
   * @param {object} data Event data published to the `end` event.
   * @param {object} [data.result] The `http.ClientRequest` returned from `request()`.
   * @param {TraceSegment} [data.segment] The external segment `handler` created.
   */
  end(data) {
    const { result: request, segment, options, host, hostname, port } = data
    if (!segment) {
      return
    }

    // `request()` threw, e.g. on an invalid path or header, so there is no
    // request to wait on. The error is rethrown to the caller.
    if (!request) {
      segment.touch()
      return
    }

    this.#captureExternalAttributes({ opts: options, request, host, port, hostname, segment })
    // This symbol is only read by the aws-sdk instrumentation, for services
    // without first-class instrumentation of their own: e.g. it adds the `aws.*`
    // attributes to this external segment rather than creating a segment.
    request[symbols.segment] = segment
    this.#instrumentRequestEmit(host, segment, request)
  }

  /**
   * Wraps the module's `request` and `get` to publish each request made in a
   * transaction to the `request` tracing channel, where `handler` and `end`
   * record it. Nothing is wrapped in Azure Functions, where the
   * `@azure/functions` instrumentation records requests instead.
   *
   * @param {object} mod The `http` or `https` module.
   */
  instrument(mod) {
    if (process.env.FUNCTIONS_WORKER_RUNTIME) {
      this.logger.debug('In azure functions environment, disabling core %s outbound instrumentation in favor of @azure/functions', this.packageName)
      return
    }

    this.#wrapRequestMethods(mod)
  }

  /**
   * Wraps the module's `request` and `get`.
   *
   * @param {object} mod The `http` or `https` module.
   */
  #wrapRequestMethods(mod) {
    const { logger } = this
    // the base class builds one channel per entry in `instrumentedMethods`
    const [channel] = this.channels

    wrapMethods({
      module: mod,
      methodNames: requestMethods,
      logger,
      wrapper: function wrapRequest(original) {
        return function wrappedRequest(input, options, cb) {
          ;[options, cb] = parseRequest(input, options, cb)
          const reqArgs = [options, cb]

          // Don't pollute metrics and calls with NR connections
          if (options?.[symbols.offTheRecord]) {
            delete options[symbols.offTheRecord]
            return original.apply(this, reqArgs)
          }

          // `handler` adds the tracing headers to `options` in place. The base
          // class skips it when no transaction is active.
          return channel.traceSync(original, { options }, this, ...reqArgs)
        }
      }
    })
  }

  /**
   * Adds the synthetics and distributed tracing headers to the request options.
   *
   * @param {Transaction} transaction The active transaction.
   * @param {object} opts The HTTP request options.
   */
  #addOutboundHeaders(transaction, opts) {
    const outboundHeaders = Object.create(null)

    opts.headers = opts.headers || {}

    synthetics.assignHeadersToOutgoingRequest(this.config, transaction, outboundHeaders)
    this.#maybeAddDtHeaders(transaction, outboundHeaders, opts?.headers)
    opts.headers = assignOutgoingHeaders(opts.headers, outboundHeaders)
  }

  /**
   * Adds the distributed tracing headers to the outgoing headers, unless
   * distributed tracing has been disabled for the request.
   *
   * @param {Transaction} transaction The active transaction.
   * @param {object} outboundHeaders The headers that are attached to the outgoing request.
   * @param {object} headers The headers from the request options.
   */
  #maybeAddDtHeaders(transaction, outboundHeaders, headers = {}) {
    // TODO: remove `symbols.disableDT` check when we drop `aws-sdk@2`
    if (headers[symbols.disableDT] || headers['x-new-relic-disable-dt']) {
      this.logger.trace('Distributed tracing disabled by instrumentation.')
      // do not try to delete this header because AWS will fail with signature fail
      // See: https://github.com/newrelic/node-newrelic/issues/1549
      return
    }

    transaction.insertDistributedTraceHeaders(outboundHeaders)
  }

  /**
   * Captures the URL, host, port, method, and query parameters of the request
   * on the external segment and span, and adds the path to the segment name.
   *
   * @param {object} params The function parameters.
   * @param {object} params.opts The HTTP request options.
   * @param {http.ClientRequest} params.request The outbound request.
   * @param {string} params.host The host, with the port when it is not the default, of the request.
   * @param {number} params.port The port of the request.
   * @param {string} params.hostname The domain of the request.
   * @param {TraceSegment} params.segment The external segment.
   */
  #captureExternalAttributes({ opts, request, host, port, hostname, segment }) {
    const absoluteUrl = this.#resolveAbsoluteUrl({ opts, request, host })

    const { parsed, obfuscatedPath } = this.#parseUrl({ absoluteUrl, request })
    if (parsed) {
      segment.name += obfuscatedPath
    }

    const proto = parsed?.protocol || opts.protocol || this.defaultProtocol

    segment.captureExternalAttributes({
      protocol: proto,
      hostname,
      host,
      method: opts.method,
      port,
      path: obfuscatedPath,
      queryParams: parsed?.parameters
    })
  }

  /**
   * Resolves the absolute URL of the outbound request:
   * 1. the path itself, when it is a proxy URL
   * 2. the protocol, host and path, when `href` does not include the path
   * 3. otherwise, `href`
   *
   * @param {object} params The function parameters.
   * @param {object} params.opts The HTTP request options.
   * @param {http.ClientRequest} params.request The outbound request.
   * @param {string} params.host The host, with the port when it is not the default, of the request.
   * @returns {string} The resolved absolute URL.
   */
  #resolveAbsoluteUrl({ opts, request, host }) {
    if (request?.path?.startsWith('http://') || request?.path?.startsWith('https://')) {
      return request.path
    }

    if (!opts?.href?.includes(request.path)) {
      const protocol = opts.protocol || this.defaultProtocol
      return `${protocol}//${host}${request.path}`
    }

    return opts.href
  }

  /**
   * Parses the absolute URL into its scrubbed path and query parameters, and
   * obfuscates the path. When the URL cannot be parsed, the request's path is
   * used as is.
   *
   * @param {object} params The function parameters.
   * @param {string} params.absoluteUrl The absolute URL of the outbound request.
   * @param {http.ClientRequest} params.request The outbound request.
   * @returns {object} The `{ parsed, obfuscatedPath }` of the URL, where
   * `parsed` is `undefined` when the URL cannot be parsed.
   */
  #parseUrl({ absoluteUrl, request }) {
    try {
      const parsed = urltils.scrubAndParseParameters(new URL(absoluteUrl))
      return { parsed, obfuscatedPath: urltils.obfuscatePath(this.config, parsed.path) }
    } catch (err) {
      this.logger.debug('Could not parse URL from request options: %s', err.message)
      return { obfuscatedPath: request.path }
    }
  }

  /**
   * Wraps the request's emit method. This is a special wrapper, instead of
   * `tracer.bindEmitter`, because some events need extra handling.
   *
   * @param {string} host The host of the request.
   * @param {TraceSegment} segment The external segment.
   * @param {http.ClientRequest} request The outbound request.
   */
  #instrumentRequestEmit(host, segment, request) {
    const self = this
    const { agent } = this
    wrapMethod({
      module: request,
      methodName: 'emit',
      logger: this.logger,
      wrapper: function wrapEmit(emit) {
        const context = agent.tracer.getContext()
        const newContext = context.enterSegment({ segment })
        return function wrappedRequestEmit(evnt, arg) {
          const transaction = agent.tracer.getTransaction()
          if (evnt === 'error') {
            segment.touch()
            self.#handleError({ transaction, req: request, error: arg })
          } else if (evnt === 'response') {
            self.#handleResponse({ segment, res: arg })
          }

          return agent.tracer.runInContext({ handler: emit, context: newContext, thisArg: this, args: arguments })
        }
      }
    })

    this.#makeNonEnumerable(request, 'emit')
  }

  /**
   * Notices the given error if there is no listener for the `error` event on
   * the request.
   *
   * @param {object} params The function parameters.
   * @param {Transaction} params.transaction The active transaction.
   * @param {http.ClientRequest} params.req The outbound request.
   * @param {Error} params.error The error that occurred during the request.
   */
  #handleError({ transaction, req, error }) {
    if (req.listenerCount('error') > 0) {
      this.logger.trace(error, 'Not capturing outbound error because user has already handled it.')
      return
    }

    this.logger.trace(error, 'Captured outbound error on behalf of the user.')
    transaction.agent.errors.add(transaction, error)
  }

  /**
   * Ties the response to the external segment.
   *
   * @param {object} params The function parameters.
   * @param {TraceSegment} params.segment The external segment.
   * @param {http.IncomingMessage} params.res The response to the request.
   */
  #handleResponse({ segment, res }) {
    // Add response attributes for spans
    segment.addSpanAttribute('http.statusCode', res.statusCode)
    segment.addSpanAttribute('http.statusText', res.statusMessage)

    // The response's events already run in the external segment's context,
    // because the request and its socket were created in it, so only the end
    // of the response needs handling. This is registered before the user's
    // `response` listeners run, so it runs before their `end` listeners.
    res.once('end', () => {
      segment.touch()
    })
  }

  /**
   * Makes a property non-enumerable.
   *
   * @param {object} obj The object that contains the property.
   * @param {string} prop The property to make non-enumerable.
   */
  #makeNonEnumerable(obj, prop) {
    try {
      const desc = Object.getOwnPropertyDescriptor(obj, prop)
      desc.enumerable = false
      Object.defineProperty(obj, prop, desc)
    } catch (e) {
      this.logger.debug(e, 'Failed to make %s non enumerable.', prop)
    }
  }
}

module.exports = HttpClientSubscriber
