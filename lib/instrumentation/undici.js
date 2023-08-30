/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const cat = require('../util/cat')
const recordExternal = require('../metrics/recorders/http_external')
const logger = require('../logger').child({ component: 'undici' })
const NAMES = require('../metrics/names')
const NEWRELIC_SYNTHETICS_HEADER = 'x-newrelic-synthetics'
const symbols = require('../symbols')
const { executionAsyncResource } = require('async_hooks')
let diagnosticsChannel = null
try {
  diagnosticsChannel = require('diagnostics_channel')
} catch (e) {
  // quick check to see if module exists
  // module was not added until v15.x
}

module.exports = function addUndiciChannels(agent, _undici, _modName, shim) {
  if (!diagnosticsChannel || !agent.config.feature_flag.undici_instrumentation) {
    logger.warn(
      'diagnostics_channel or feature_flag.undici_instrumentation = false. Skipping undici instrumentation.'
    )
    return
  }

  registerHookPoints(shim)
}

/**
 * Subscribes to all relevant undici hook points
 * See: https://github.com/nodejs/undici/blob/main/docs/api/DiagnosticsChannel.md
 *
 * @param {Shim} shim instance of shim
 */
function registerHookPoints(shim) {
  const requestCreate = diagnosticsChannel.channel('undici:request:create')
  requestCreate.subscribe(requestCreateHook.bind(null, shim))
  const requestHeaders = diagnosticsChannel.channel('undici:request:headers')
  requestHeaders.subscribe(requestHeadersHook.bind(null, shim))
  const requestTrailers = diagnosticsChannel.channel('undici:request:trailers')
  requestTrailers.subscribe(endAndRestoreSegment.bind(null, shim))
  const requestError = diagnosticsChannel.channel('undici:request:error')
  requestError.subscribe(endAndRestoreSegment.bind(null, shim))
}

/**
 * Retrieves the current segment in transaction(parent in our context) from executionAsyncResource
 * or from `shim.getSegment()` then adds to the executionAsyncResource for future
 * undici requests within same async context.
 *
 * It was found that when running concurrent undici requests
 * within a transaction that the parent segment would get out of sync
 * depending on the async context of the transaction.  By using
 * `async_hooks.executionResource` it is more reliable.
 *
 * Note: However, if you have concurrent undici requests in a transaction
 * and the request to the transaction is using a keep alive there is a chance the
 * executionAsyncResource may be incorrect because of shared connections.  To revert to a more
 * naive tracking of parent set `config.feature_flag.undici_async_tracking: false` and
 * it will just call `shim.getSegment()`
 *
 * @param {Shim} shim instance of shim
 * @returns {TraceSegment} parent segment
 */
function getParentSegment(shim) {
  const { config } = shim.agent
  if (config.feature_flag.undici_async_tracking) {
    const resource = executionAsyncResource()

    if (!resource[symbols.parentSegment]) {
      const parent = shim.getSegment()
      resource[symbols.parentSegment] = parent
    }
    return resource[symbols.parentSegment]
  }
  return shim.getSegment()
}

/**
 * This event occurs after the Undici Request is created
 * We will check current segment for opaque and also attach
 * relevant headers to outgoing http request
 *
 * @param {Shim} shim instance of shim
 * @param {object} params object from undici hook
 * @param {object} params.request undici request object
 */
function requestCreateHook(shim, { request }) {
  const { config } = shim.agent
  const parent = getParentSegment(shim)
  request[symbols.parentSegment] = parent
  if (!parent || (parent && parent.opaque)) {
    logger.trace(
      'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
      request.path,
      parent && parent.name
    )

    return
  }

  const transaction = parent.transaction
  const outboundHeaders = Object.create(null)
  if (config.encoding_key && transaction.syntheticsHeader) {
    outboundHeaders[NEWRELIC_SYNTHETICS_HEADER] = transaction.syntheticsHeader
  }

  if (config.distributed_tracing.enabled) {
    transaction.insertDistributedTraceHeaders(outboundHeaders)
  } else if (config.cross_application_tracer.enabled) {
    cat.addCatHeaders(config, transaction, outboundHeaders)
  } else {
    logger.trace('Both DT and CAT are disabled, not adding headers!')
  }

  // eslint-disable-next-line guard-for-in
  for (const key in outboundHeaders) {
    request.addHeader(key, outboundHeaders[key])
  }

  const url = new URL(request.origin + request.path)
  const name = NAMES.EXTERNAL.PREFIX + url.host + url.pathname
  const segment = shim.createSegment(name, recordExternal(url.host, 'undici'), parent)
  if (segment) {
    segment.start()
    shim.setActiveSegment(segment)
    segment.addAttribute('url', `${url.protocol}//${url.host}${url.pathname}`)

    url.searchParams.forEach((value, key) => {
      segment.addSpanAttribute(`request.parameters.${key}`, value)
    })
    segment.addAttribute('procedure', request.method || 'GET')
    request[symbols.segment] = segment
  }
}

/**
 * This event occurs after the response headers have been received.
 * We will add the relevant http response attributes to active segment.
 * Also add CAT specific keys to active segment.
 *
 * @param {Shim} shim instance of shim
 * @param {object} params object from undici hook
 * @param {object} params.request undici request object
 * @param {object} params.response { statusCode, headers, statusText }
 */
function requestHeadersHook(shim, { request, response }) {
  const { config } = shim.agent
  const activeSegment = request[symbols.segment]
  if (!activeSegment) {
    return
  }

  activeSegment.addSpanAttribute('http.statusCode', response.statusCode)
  activeSegment.addSpanAttribute('http.statusText', response.statusText)

  if (config.cross_application_tracer.enabled && !config.distributed_tracing.enabled) {
    try {
      const { appData } = cat.extractCatHeaders(response.headers)
      const decodedAppData = cat.parseAppData(config, appData)
      const attrs = activeSegment.getAttributes()
      const url = new URL(attrs.url)
      cat.assignCatToSegment(decodedAppData, activeSegment, url.host)
    } catch (err) {
      logger.warn(err, 'Cannot add CAT data to segment')
    }
  }
}

/**
 * Gets the active and parent from given ctx(request, client connector)
 * and ends active and restores parent to active.  If an error exists
 * it will add the error to the transaction
 *
 * @param {Shim} shim instance of shim
 * @param {object} params object from undici hook
 * @param {object} params.request or client connector
 * @param {Error} params.error error from undici request
 */
function endAndRestoreSegment(shim, { request, error }) {
  const activeSegment = request[symbols.segment]
  const parentSegment = request[symbols.parentSegment]
  if (activeSegment) {
    activeSegment.end()

    if (error) {
      handleError(shim, activeSegment, error)
    }

    if (parentSegment) {
      shim.setActiveSegment(parentSegment)
    }
  }
}

/**
 * Adds the error to the active transaction
 *
 * @param {Shim} shim instance of shim
 * @param {TraceSegment} activeSegment active segment
 * @param {Error} error error from undici request
 */
function handleError(shim, activeSegment, error) {
  logger.trace(error, 'Captured outbound error on behalf of the user.')
  const { transaction } = activeSegment
  shim.agent.errors.add(transaction, error)
}
