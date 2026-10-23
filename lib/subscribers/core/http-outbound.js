/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { URL } = require('node:url')
const BaseCoreSubscriber = require('./base')
const { wrapMethod } = require('../wrap-method')
const NAMES = require('#agentlib/metrics/names.js')
const recordExternal = require('#agentlib/metrics/recorders/http_external.js')
const symbols = require('#agentlib/symbols.js')
const synthetics = require('#agentlib/synthetics.js')
const urltils = require('#agentlib/util/urltils.js')

const DEFAULT_HOST = 'localhost'
const DEFAULT_HTTP_PORT = 80
const DEFAULT_SSL_PORT = 443
const instrumentedMethods = ['request']

/**
 * Records outbound `http` and `https` requests. Unlike the other core
 * subscribers, this one does not patch anything: `http.request` and `http.get`
 * (and their `https` counterparts) are wrapped by
 * `lib/instrumentation/core/http.js`, which publishes each request to the
 * `nr:http:request` tracing channel this subscriber listens on.
 */
class HttpOutboundSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'http', instrumentedMethods })
  }

  /**
   * Checks whether `http` or `https` instrumentation is enabled. Both modules
   * publish to the same channel, so this subscriber must listen when either is.
   *
   * @returns {boolean} `true` when either module's instrumentation is enabled.
   */
  get enabled() {
    const { instrumentation } = this.config
    return instrumentation.http.enabled === true || instrumentation.https.enabled === true
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
    const { host, hostname, port } = extractHostPortViaProxy(options) ?? extractHostPort(options)

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
    if (!segment || !request) {
      return
    }

    this.#applySegment({ opts: options, request, host, port, hostname, segment })
    this.#instrumentRequestEmit(host, segment, request)
  }

  /**
   * No-op: the request methods are wrapped by `lib/instrumentation/core/http.js`.
   * This is temporary until the `http` instrumentation is refactored to a
   * subscriber, at which point this should wrap `request` and `get` itself.
   */
  instrument() {}

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
   * Names the external segment and attaches the relevant attributes to the
   * segment and span.
   *
   * @param {object} params The function parameters.
   * @param {object} params.opts The HTTP request options.
   * @param {http.ClientRequest} params.request The outbound request.
   * @param {string} params.host The host, with the port when it is not the default, of the request.
   * @param {string} params.port The port of the request.
   * @param {string} params.hostname The domain of the request.
   * @param {TraceSegment} params.segment The external segment.
   */
  #applySegment({ opts, request, host, port, hostname, segment }) {
    // Parse the appropriate URL from the request options
    // 1. If the path is a proxy url use the entire path
    // 2. construct url from path, protocol and host if href does not already include path
    // 3. use href to construct url
    let absoluteUrl = null
    if (request?.path?.startsWith('http://') || request?.path?.startsWith('https://')) {
      absoluteUrl = request.path
    } else if (!opts?.href?.includes(request.path)) {
      const protocol = opts.protocol || 'http:'
      absoluteUrl = `${protocol}//${host}${request.path}`
    } else {
      absoluteUrl = opts.href
    }

    let obfuscatedPath, parsed
    try {
      const urlObject = new URL(absoluteUrl)
      parsed = urltils.scrubAndParseParameters(urlObject)
      obfuscatedPath = urltils.obfuscatePath(this.config, parsed.path)
      segment.name += obfuscatedPath
    } catch (err) {
      this.logger.debug('Could not parse URL from request options: %s', err.message)
      obfuscatedPath = request.path
    }

    const proto = parsed?.protocol || opts.protocol || 'http:'

    segment.captureExternalAttributes({
      protocol: proto,
      hostname,
      host,
      method: opts.method,
      port,
      path: obfuscatedPath,
      queryParams: parsed?.parameters
    })
    request[symbols.segment] = segment
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
            segment.end()
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
   * @returns {boolean} `true` if the error will be collected by New Relic.
   */
  #handleError({ transaction, req, error }) {
    if (req.listenerCount('error') > 0) {
      this.logger.trace(error, 'Not capturing outbound error because user has already handled it.')
      return false
    }

    this.logger.trace(error, 'Captured outbound error on behalf of the user.')
    transaction.agent.errors.add(transaction, error)
    return true
  }

  /**
   * Ties the response to the external segment.
   *
   * @param {object} params The function parameters.
   * @param {TraceSegment} params.segment The external segment.
   * @param {http.IncomingMessage} params.res The response to the request.
   */
  #handleResponse({ segment, res }) {
    const { agent } = this

    // Add response attributes for spans
    segment.addSpanAttribute('http.statusCode', res.statusCode)
    segment.addSpanAttribute('http.statusText', res.statusMessage)

    // Again a custom emit wrapper because we want to watch for the `end` event.
    wrapMethod({
      module: res,
      methodName: 'emit',
      logger: this.logger,
      wrapper: function wrapEmit(emit) {
        const context = agent.tracer.getContext()
        const newContext = context.enterSegment({ segment })
        return function wrappedResponseEmit(evnt) {
          if (evnt === 'end') {
            segment.end()
          }
          return agent.tracer.runInContext({ handler: emit, context: newContext, thisArg: this, args: arguments })
        }
      }
    })
    this.#makeNonEnumerable(res, 'emit')
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

/**
 * Determines the default port: 80 if the protocol is undefined or `http:`,
 * otherwise 443.
 *
 * @param {object} opts The HTTP request options.
 * @returns {number} The default port.
 */
function getDefaultPort(opts) {
  return !opts.protocol || opts.protocol === 'http:' ? DEFAULT_HTTP_PORT : DEFAULT_SSL_PORT
}

/**
 * Determines the port from the HTTP request options.
 *
 * @param {object} opts The HTTP request options.
 * @param {number} defaultPort The port to use when the options do not specify one.
 * @returns {number} The port.
 */
function getPort(opts, defaultPort) {
  let port = opts.port || opts.defaultPort
  if (!port) {
    port = defaultPort
  }

  return port
}

/**
 * Determines the hostname from the HTTP request options.
 *
 * @param {object} opts The HTTP request options.
 * @returns {string} The hostname, or `localhost` when the options do not specify one.
 */
function getDefaultHostName(opts) {
  return opts.hostname || opts.host || DEFAULT_HOST
}

/**
 * Extracts the host, hostname, and port from the HTTP request options.
 *
 * @param {object} opts The HTTP request options.
 * @returns {object} The `{ host, hostname, port }` of the request.
 */
function extractHostPort(opts) {
  const defaultPort = getDefaultPort(opts)
  const hostname = getDefaultHostName(opts)
  const port = getPort(opts, defaultPort)
  let host = hostname
  if (port && port !== defaultPort) {
    host += `:${port}`
  }
  return { host, hostname, port }
}

/**
 * Extracts the host, hostname, and port from the HTTP request options when
 * using a proxy.
 *
 * @param {object} opts The HTTP request options.
 * @returns {object|null} The `{ host, hostname, port }` of the request if it is
 * a proxy request, otherwise `null`.
 */
function extractHostPortViaProxy(opts) {
  const pathname = opts.pathname || opts.path

  if (pathname && (pathname.startsWith('https://') || pathname.startsWith('http://'))) {
    const url = new URL(pathname)
    return {
      host: url.host,
      hostname: url.hostname,
      port: url.port || url.protocol === 'https:' ? '443' : '80'
    }
  }

  return null
}

/**
 * Assigns new headers for the outgoing request.
 *
 * @param {object|Array} currentHeaders The headers from the request options.
 * @param {object} outboundHeaders The headers to add to the outgoing request.
 * @returns {object|Array} The merged headers, in the same format as `currentHeaders`.
 */
function assignOutgoingHeaders(currentHeaders, outboundHeaders) {
  let headers

  if (Array.isArray(currentHeaders)) {
    headers = currentHeaders.slice()
    Array.prototype.push.apply(
      headers,
      Object.keys(outboundHeaders).map(function getHeaderTuples(key) {
        return [key, outboundHeaders[key]]
      })
    )
  } else {
    headers = Object.assign(Object.create(null), currentHeaders, outboundHeaders)
  }

  return headers
}

module.exports = HttpOutboundSubscriber
