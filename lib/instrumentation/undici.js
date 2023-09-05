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
const diagnosticsChannel = require('diagnostics_channel')

const channels = [
  { channel: diagnosticsChannel.channel('undici:request:create'), hook: requestCreateHook },
  { channel: diagnosticsChannel.channel('undici:request:headers'), hook: requestHeadersHook },
  { channel: diagnosticsChannel.channel('undici:request:trailers'), hook: endAndRestoreSegment },
  { channel: diagnosticsChannel.channel('undici:request:error'), hook: endAndRestoreSegment }
]

/**
 * Subscribes to all relevant undici hook points
 * See: https://github.com/nodejs/undici/blob/main/docs/api/DiagnosticsChannel.md
 *
 * @param agent
 * @param _undici
 * @param _modName
 * @param shim
 */
module.exports = function addUndiciChannels(agent, _undici, _modName, shim) {
  channels.forEach(({ channel, hook }) => {
    if (!channel.hasSubscribers) {
      channel.subscribe(hook.bind(null, shim))
    }
  })
}

module.exports.unsubscribe = function unsubscribe() {
  channels.forEach(({ channel, hook }) => {
    if (channel.hasSubscribers) {
      channel.unsubscribe(hook)
    }
  })
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
 * Injects relevant DT headers for the external request
 *
 * @param {object} params object to fn
 * @param {Shim} params.transaction current transaction
 * @param {object} params.request undici request object
 * @param {object} params.config agent config
 */
function addDTHeaders({ transaction, config, request }) {
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
}

/**
 * Creates the external segment with url, procedure and request.parameters attributes
 *
 * @param {object} params object to fn
 * @param {Shim} params.shim instance of shim
 * @param {object} params.request undici request object
 * @param {object} params.parentSegment current active, about to be parent of external segment
 */
function createExternalSegment({ shim, request, parentSegment }) {
  const url = new URL(request.origin + request.path)
  const name = NAMES.EXTERNAL.PREFIX + url.host + url.pathname
  // Metrics for `External/<host>` will have a suffix of undici
  // We will have to see if this matters for people only using fetch
  // It's undici under the hood so ¯\_(ツ)_/¯
  const segment = shim.createSegment(name, recordExternal(url.host, 'undici'), parentSegment)
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
 * This event occurs after the Undici Request is created.
 * We will check current segment for opaque before creating the
 * external segment with the standard url/procedure/request.parameters
 * attributes.  We will also attach relevant DT headers to outgoing http request.
 *
 * @param {Shim} shim instance of shim
 * @param {object} params object from undici hook
 * @param {object} params.request undici request object
 */
function requestCreateHook(shim, { request }) {
  const { config } = shim.agent
  const parentSegment = getParentSegment(shim)
  request[symbols.parentSegment] = parentSegment
  if (!parentSegment || (parentSegment && parentSegment.opaque)) {
    logger.trace(
      'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
      request.path,
      parentSegment && parentSegment.name
    )

    return
  }

  try {
    addDTHeaders({ transaction: parentSegment.transaction, config, request })
    createExternalSegment({ shim, request, parentSegment })
  } catch (err) {
    logger.warn(err, 'Unable to create external segment')
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
