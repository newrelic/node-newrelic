/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const cat = require('../util/cat')
const recordExternal = require('../metrics/recorders/http_external')
const logger = require('../logger').child({ component: 'undici' })
const NAMES = require('../metrics/names')
const symbols = require('../symbols')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const diagnosticsChannel = require('diagnostics_channel')
const synthetics = require('../synthetics')
const urltils = require('../util/urltils')

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
 * Injects relevant DT headers for the external request
 *
 * @param {object} params object to fn
 * @param {Shim} params.transaction current transaction
 * @param {object} params.request undici request object
 * @param {object} params.config agent config
 */
function addDTHeaders({ transaction, config, request }) {
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
    request.addHeader(key, outboundHeaders[key])
  }
}

/**
 * Creates the external segment with url, procedure and request.parameters attributes
 *
 * @param {object} params object to fn
 * @param {Shim} params.shim instance of shim
 * @param {object} params.request undici request object
 * @param {TraceSegment} params.segment current active, about to be parent of external segment
 */
function createExternalSegment({ shim, request, segment }) {
  const url = new URL(request.origin + request.path)
  const obfuscatedPath = urltils.obfuscatePath(shim.agent.config, url.pathname)
  const name = NAMES.EXTERNAL.PREFIX + url.host + obfuscatedPath
  // Metrics for `External/<host>` will have a suffix of undici
  // We will have to see if this matters for people only using fetch
  // It's undici under the hood so ¯\_(ツ)_/¯
  const externalSegment = shim.createSegment(name, recordExternal(url.host, 'undici'), segment)

  // the captureExternalAttributes expects queryParams to be an object, do conversion
  // to object see:  https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
  const queryParams = Object.fromEntries(url.searchParams.entries())

  if (externalSegment) {
    externalSegment.start()
    shim.setActiveSegment(externalSegment)
    externalSegment.captureExternalAttributes({
      protocol: url.protocol,
      hostname: url.hostname,
      host: url.host,
      method: request.method,
      port: url.port,
      path: obfuscatedPath,
      queryParams
    })

    request[symbols.segment] = externalSegment
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
  const { transaction, segment } = shim.tracer.getContext()
  request[symbols.parentSegment] = segment
  request[symbols.transaction] = transaction
  if (!(segment || transaction) || segment?.opaque) {
    logger.trace(
      'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
      request.path,
      segment?.name
    )

    return
  }

  try {
    createExternalSegment({ shim, request, segment })
    addDTHeaders({ transaction, config, request })
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
  const transaction = request[symbols.transaction]
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
      cat.assignCatToSegment({
        appData: decodedAppData,
        segment: activeSegment,
        host: url.host,
        transaction
      })
    } catch (err) {
      logger.warn(err, 'Cannot add CAT data to segment')
    }
  }
}

/**
 * Gets the active segment, parent segment and transaction from given ctx(request, client connector)
 * and ends segment and sets the previous parent segment as the active segment.  If an error exists it will add the error to the transaction
 *
 * @param {Shim} shim instance of shim
 * @param {object} params object from undici hook
 * @param {object} params.request or client connector
 * @param {Error} params.error error from undici request
 */
function endAndRestoreSegment(shim, { request, error }) {
  const activeSegment = request[symbols.segment]
  const parentSegment = request[symbols.parentSegment]
  const tx = request[symbols.transaction]
  if (activeSegment) {
    activeSegment.end()
  }

  if (error && tx) {
    handleError(shim, tx, error)
  }

  if (parentSegment) {
    shim.setActiveSegment(parentSegment)
  }
}

/**
 * Adds the error to the active transaction
 *
 * @param {Shim} shim instance of shim
 * @param {Transaction} tx active transaction
 * @param {Error} error error from undici request
 */
function handleError(shim, tx, error) {
  logger.trace(error, 'Captured outbound error on behalf of the user.')
  shim.agent.errors.add(tx, error)
}
