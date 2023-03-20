/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const recordExternal = require('../../metrics/recorders/http_external')
const cat = require('../../util/cat')
const urltils = require('../../util/urltils')
const logger = require('../../logger').child({ component: 'outbound' })
const shimmer = require('../../shimmer')
const url = require('url')
const copy = require('../../util/copy')
const symbols = require('../../symbols')
const http = require('http')

const NAMES = require('../../metrics/names')

const DEFAULT_HOST = 'localhost'
const DEFAULT_HTTP_PORT = 80
const DEFAULT_SSL_PORT = 443

const NEWRELIC_SYNTHETICS_HEADER = 'x-newrelic-synthetics'

/**
 * Determines the default port to 80 if protocol is undefined or http:
 * Otherwise it assigns it as 443
 *
 * @param {object} opts HTTP request options
 * @returns {number} default port
 */
function getDefaultPort(opts) {
  return !opts.protocol || opts.protocol === 'http:' ? DEFAULT_HTTP_PORT : DEFAULT_SSL_PORT
}

/**
 * Determines the port based on http opts
 *
 * @param {object} opts HTTP request options
 * @param {number} defaultPort the default port
 * @returns {number} port
 */
function getPort(opts, defaultPort) {
  let port = opts.port || opts.defaultPort
  if (!port) {
    port = defaultPort
  }

  return port
}

/**
 * Determines the default hostname based on http opts
 *
 * @param {object} opts HTTP request options
 * @returns {string} default host
 */
function getDefaultHostName(opts) {
  return opts.hostname || opts.host || DEFAULT_HOST
}

/**
 * Parses http opts to an object
 * If string will call url.parse, otherwise it will
 * do a shallow copy
 *
 * @param {string|object} opts a url string or HTTP request options
 * @returns {object} parsed http opts
 */
function parseOpts(opts) {
  if (typeof opts === 'string') {
    opts = url.parse(opts)
  } else {
    opts = copy.shallow(opts)
  }

  return opts
}

/**
 * Instruments an outbound HTTP request.
 *
 * @param {Agent} agent instantiation of lib/agent.js
 * @param {object} opts HTTP request options
 * @param {Function} makeRequest function for issuing actual HTTP request
 * @returns {object} The instrumented outbound HTTP request.
 */
module.exports = function instrumentOutbound(agent, opts, makeRequest) {
  opts = parseOpts(opts)
  const defaultPort = getDefaultPort(opts)
  let hostname = getDefaultHostName(opts)
  const port = getPort(opts, defaultPort)

  if (!hostname || port < 1) {
    logger.warn('Invalid host name (%s) or port (%s) for outbound request.', hostname, port)
    return makeRequest(opts)
  }

  if (port && port !== defaultPort) {
    hostname += ':' + port
  }

  const name = NAMES.EXTERNAL.PREFIX + hostname

  const parent = agent.tracer.getSegment()
  if (parent && parent.opaque) {
    logger.trace(
      'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
      name,
      parent.name
    )

    return makeRequest(opts)
  }

  return agent.tracer.addSegment(
    name,
    recordExternal(hostname, 'http'),
    parent,
    false,
    instrumentRequest.bind(null, agent, opts, makeRequest, hostname)
  )
}

/**
 * Injects DT/CAT headers, creates segment for outbound http request.
 * Instruments the request.emit to properly handle the response of the
 * outbound http request
 *
 * @param {Agent} agent New Relic agent
 * @param {string|object} opts a url string or HTTP request options
 * @param {Function} makeRequest function to make request
 * @param {string} hostname host of outbound request
 * @param {TraceSegment} segment outbound http segment
 * @returns {http.IncomingMessage} request actual http outbound request
 */
function instrumentRequest(agent, opts, makeRequest, hostname, segment) {
  const transaction = segment.transaction
  const outboundHeaders = Object.create(null)

  if (agent.config.encoding_key && transaction.syntheticsHeader) {
    outboundHeaders[NEWRELIC_SYNTHETICS_HEADER] = transaction.syntheticsHeader
  }

  maybeAddDtCatHeaders(agent, transaction, outboundHeaders, opts?.headers)
  opts.headers = assignOutgoingHeaders(opts.headers, outboundHeaders)

  const request = applySegment(opts, makeRequest, hostname, segment)

  instrumentRequestEmit(agent, hostname, segment, request)

  return request
}

/**
 * Depending on configuration it will either add DT or CAT headers to the
 * outgoing headers
 *
 * @param {Agent} agent Node.js agent
 * @param {Transaction} transaction active transaction
 * @param {object} outboundHeaders headers that are getting attached to external http call
 * @param {object} headers headers for http request
 */
// TODO: abstract header logic shared with TransactionShim#insertCATRequestHeaders
function maybeAddDtCatHeaders(agent, transaction, outboundHeaders, headers = {}) {
  if (agent.config.distributed_tracing.enabled) {
    if (!!(headers[symbols.disableDT] || headers['x-new-relic-disable-dt'])) {
      logger.trace('Distributed tracing disabled by instrumentation.')
      // do not try to delete this header because AWS will fail with signature fail
      // See: https://github.com/newrelic/node-newrelic/issues/1549
    } else {
      transaction.insertDistributedTraceHeaders(outboundHeaders)
    }
  } else if (agent.config.cross_application_tracer.enabled) {
    cat.addCatHeaders(agent.config, transaction, outboundHeaders)
  } else {
    logger.trace('Both DT and CAT are disabled, not adding headers!')
  }
}

/**
 * Assigns new headers for outgoing request
 *
 * @param {object|Array} currentHeaders current headers from request options headers
 * @param {object} outboundHeaders headers to assign to outgoing request
 * @returns {object|Array} properly formatted headers
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

/**
 * Starts the http outbound segment and attaches relevant attributes to the segment/span.
 *
 * @param {string|object} opts a url string or HTTP request options
 * @param {Function} makeRequest function to make request
 * @param {string} hostname host of outbound request
 * @param {TraceSegment} segment outbound http segment
 * @returns {http.IncomingMessage} request actual http outbound request
 */
function applySegment(opts, makeRequest, hostname, segment) {
  segment.start()
  const request = makeRequest(opts)
  const parsed = urltils.scrubAndParseParameters(request.path)
  parsed.path = urltils.obfuscatePath(segment.transaction.agent.config, parsed.path)
  const proto = parsed.protocol || opts.protocol || 'http:'
  segment.name += parsed.path
  request[symbols.segment] = segment

  if (parsed.parameters) {
    // Scrub and parse returns on object with a null prototype.
    // eslint-disable-next-line guard-for-in
    for (const key in parsed.parameters) {
      segment.addSpanAttribute(`request.parameters.${key}`, parsed.parameters[key])
    }
  }
  segment.addAttribute('url', `${proto}//${hostname}${parsed.path}`)
  segment.addAttribute('procedure', opts.method || 'GET')
  return request
}

/**
 * Wrap the emit method. We're doing a special wrapper instead of using
 * `tracer.bindEmitter` because we want to do some logic based on certain
 * events.
 *
 * @param {Agent} agent New Relic agent
 * @param {string} hostname host of outbound request
 * @param {TraceSegment} segment outbound http segment
 * @param {http.IncomingMessage} request actual http outbound request
 */
function instrumentRequestEmit(agent, hostname, segment, request) {
  shimmer.wrapMethod(request, 'request.emit', 'emit', function wrapEmit(emit) {
    const boundEmit = agent.tracer.bindFunction(emit, segment)
    return function wrappedRequestEmit(evnt, arg) {
      if (evnt === 'error') {
        segment.end()
        handleError(segment, request, arg)
      } else if (evnt === 'response') {
        handleResponse(segment, hostname, arg)
      }

      return boundEmit.apply(this, arguments)
    }
  })

  _makeNonEnumerable(request, 'emit')
}

/**
 * Notices the given error if there is no listener for the `error` event on the
 * request object.
 *
 * @param {object} segment TraceSegment instance
 * @param {object} req http.ClientRequest
 * @param {Error} error If provided, unhandled error that occurred during request
 * @returns {boolean} True if the error will be collected by New Relic.
 */
function handleError(segment, req, error) {
  if (req.listenerCount('error') > 0) {
    logger.trace(error, 'Not capturing outbound error because user has already handled it.')
    return false
  }

  logger.trace(error, 'Captured outbound error on behalf of the user.')
  const tx = segment.transaction
  tx.agent.errors.add(tx, error)
  return true
}

/**
 * Ties the response object to the request segment.
 *
 * @param {object} segment TraceSegment instance
 * @param {string} hostname host of the HTTP request
 * @param {object} res http.ServerResponse
 */
function handleResponse(segment, hostname, res) {
  // Add response attributes for spans
  segment.addSpanAttribute('http.statusCode', res.statusCode)
  segment.addSpanAttribute('http.statusText', res.statusMessage)

  // If CAT is enabled, grab those headers!
  const agent = segment.transaction.agent
  if (agent.config.cross_application_tracer.enabled && !agent.config.distributed_tracing.enabled) {
    const { appData } = cat.extractCatHeaders(res.headers)
    const decodedAppData = cat.parseAppData(agent.config, appData)
    cat.assignCatToSegment(decodedAppData, segment, hostname)
  }

  // Again a custom emit wrapper because we want to watch for the `end` event.
  shimmer.wrapMethod(res, 'response', 'emit', function wrapEmit(emit) {
    const boundEmit = agent.tracer.bindFunction(emit, segment)
    return function wrappedResponseEmit(evnt) {
      if (evnt === 'end') {
        segment.end()
      }
      return boundEmit.apply(this, arguments)
    }
  })
  _makeNonEnumerable(res, 'emit')
}

/**
 * Makes a property non-enumerable
 *
 * @param {object} obj object that contains property that needs to be non-enumerable
 * @param {string} prop property to make non-enumerable
 */
function _makeNonEnumerable(obj, prop) {
  try {
    const desc = Object.getOwnPropertyDescriptor(obj, prop)
    desc.enumerable = false
    Object.defineProperty(obj, prop, desc)
  } catch (e) {
    logger.debug(e, 'Failed to make %s non enumerable.', prop)
  }
}
