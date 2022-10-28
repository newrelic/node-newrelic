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

const NAMES = require('../../metrics/names')

const DEFAULT_HOST = 'localhost'
const DEFAULT_HTTP_PORT = 80
const DEFAULT_SSL_PORT = 443

const NEWRELIC_SYNTHETICS_HEADER = 'x-newrelic-synthetics'

/**
 * Instruments an outbound HTTP request.
 *
 * @param {Agent} agent
 * @param {object} opts
 * @param {Function} makeRequest
 * @returns {http.ClientRequest} The instrumented outbound request.
 */
module.exports = function instrumentOutbound(agent, opts, makeRequest) {
  if (typeof opts === 'string') {
    opts = url.parse(opts)
  } else {
    opts = copy.shallow(opts)
  }

  const defaultPort =
    !opts.protocol || opts.protocol === 'http:' ? DEFAULT_HTTP_PORT : DEFAULT_SSL_PORT
  let hostname = opts.hostname || opts.host || DEFAULT_HOST
  let port = opts.port || opts.defaultPort
  if (!port) {
    port = defaultPort
  }

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
    instrumentRequest
  )

  function instrumentRequest(segment) {
    const transaction = segment.transaction
    const outboundHeaders = Object.create(null)

    if (agent.config.encoding_key && transaction.syntheticsHeader) {
      outboundHeaders[NEWRELIC_SYNTHETICS_HEADER] = transaction.syntheticsHeader
    }

    // TODO: abstract header logic shared with TransactionShim#insertCATRequestHeaders
    if (agent.config.distributed_tracing.enabled) {
      if (opts.headers && opts.headers[symbols.disableDT]) {
        logger.trace('Distributed tracing disabled by instrumentation.')
      } else {
        transaction.insertDistributedTraceHeaders(outboundHeaders)
      }
    } else if (agent.config.cross_application_tracer.enabled) {
      cat.addCatHeaders(agent.config, transaction, outboundHeaders)
    } else {
      logger.trace('Both DT and CAT are disabled, not adding headers!')
    }

    if (Array.isArray(opts.headers)) {
      opts.headers = opts.headers.slice()
      Array.prototype.push.apply(
        opts.headers,
        Object.keys(outboundHeaders).map(function getHeaderTuples(key) {
          return [key, outboundHeaders[key]]
        })
      )
    } else {
      opts.headers = Object.assign(Object.create(null), opts.headers, outboundHeaders)
    }

    segment.start()
    const request = makeRequest(opts)
    const parsed = urltils.scrubAndParseParameters(request.path)
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

    // Wrap the emit method. We're doing a special wrapper instead of using
    // `tracer.bindEmitter` because we want to do some logic based on certain
    // events.
    shimmer.wrapMethod(request, 'request.emit', 'emit', function wrapEmit(emit) {
      const boundEmit = agent.tracer.bindFunction(emit, segment)
      return function wrappedRequestEmit(evnt, arg) {
        if (evnt === 'error') {
          segment.end()
          handleError(segment, request, arg)
        } else if (evnt === 'response') {
          handleResponse(segment, hostname, request, arg)
        }

        return boundEmit.apply(this, arguments)
      }
    })
    _makeNonEnumerable(request, 'emit')

    return request
  }
}

/**
 * Notices the given error if there is no listener for the `error` event on the
 * request object.
 *
 * @param {TraceSegment} segment
 * @param {http.ClientRequest} req
 * @param {Error} error
 * @returns {bool} True if the error will be collected by New Relic.
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
 * @param {TraceSegment} segment
 * @param {string} hostname
 * @param {http.ClientRequest} req
 * @param {http.IncomingMessage} res
 */
function handleResponse(segment, hostname, req, res) {
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

function _makeNonEnumerable(obj, prop) {
  try {
    const desc = Object.getOwnPropertyDescriptor(obj, prop)
    desc.enumerable = false
    Object.defineProperty(obj, prop, desc)
  } catch (e) {
    logger.debug(e, 'Failed to make %s non enumerable.', prop)
  }
}
