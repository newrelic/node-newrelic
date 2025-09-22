/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const cat = require('../util/cat')
const recordExternal = require('../metrics/recorders/http_external')
const logger = require('../logger').child({ component: 'undici' })
const NAMES = require('../metrics/names')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const diagnosticsChannel = require('diagnostics_channel')
const synthetics = require('../synthetics')
const urltils = require('../util/urltils')

const channels = [
  { channel: 'undici:request:create', hook: requestCreateHook },
  { channel: 'undici:request:headers', hook: requestHeadersHook },
  { channel: 'undici:request:trailers', hook: endAndRestoreSegment },
  { channel: 'undici:request:error', hook: endAndRestoreSegment }
]

/**
 * Subscribes to all relevant undici hook points
 * See: https://github.com/nodejs/undici/blob/main/docs/api/DiagnosticsChannel.md
 *
 * @param {Agent} agent instance
 */
module.exports = function addUndiciChannels(agent) {
  channels.forEach(({ channel, hook }, index) => {
    const boundHook = hook.bind(null, agent)
    diagnosticsChannel.subscribe(channel, boundHook)
    // store the bound hook for unsubscription later
    channels[index].boundHook = boundHook
  })
}

module.exports.unsubscribe = function unsubscribe() {
  channels.forEach(({ channel, boundHook }) => {
    diagnosticsChannel.unsubscribe(channel, boundHook)
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
 * @param {Agent} params.agent NR agent instance
 * @param {object} params.request undici request object
 * @param {object} params.context active context
 */
function createExternalSegment({ agent, request, context }) {
  const url = new URL(request.origin + request.path)
  const obfuscatedPath = urltils.obfuscatePath(agent.config, url.pathname)
  const name = NAMES.EXTERNAL.PREFIX + url.host + obfuscatedPath
  const transaction = context?.transaction
  const parent = context?.extras?.undiciParent
  // Metrics for `External/<host>` will have a suffix of undici
  // We will have to see if this matters for people only using fetch
  // It's undici under the hood so ¯\_(ツ)_/¯
  const externalSegment = agent.tracer.createSegment({
    name,
    recorder: recordExternal(url.host, 'undici'),
    parent,
    transaction
  })

  // the captureExternalAttributes expects queryParams to be an object, do conversion
  // to object see:  https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
  const queryParams = Object.fromEntries(url.searchParams.entries())

  if (externalSegment) {
    externalSegment.start()
    // storing the undici external segment in the context extras
    // this has to be done because the various hook points produce different segments
    // and we need to be able to access the segment later
    context.extras = { undiciSegment: externalSegment }
    agent.tracer.setSegment({ segment: externalSegment, transaction })
    externalSegment.captureExternalAttributes({
      protocol: url.protocol,
      hostname: url.hostname,
      host: url.host,
      method: request.method,
      port: url.port,
      path: obfuscatedPath,
      queryParams
    })
  }
}

/**
 * This event occurs after the Undici Request is created.
 * We will check current segment for opaque before creating the
 * external segment with the standard url/procedure/request.parameters
 * attributes.  We will also attach relevant DT headers to outgoing http request.
 *
 * @param {Agent} agent NR agent instance
 * @param {object} params object from undici hook
 * @param {object} params.request undici request object
 */
function requestCreateHook(agent, { request }) {
  const { config } = agent
  const context = agent.tracer.getContext()
  const { segment, transaction } = context
  // storing the parent of the undici external segment in the context extras
  // this has to be done because the various hook points produce different segments
  // and we need to be able to access the segment later
  context.extras = { undiciParent: segment }
  if (!(segment || transaction) || segment?.opaque) {
    logger.trace(
      'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
      request.path,
      segment?.name
    )

    return
  }

  try {
    createExternalSegment({ agent, request, context })
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
 * @param {Agent} agent instance
 * @param {object} params object from undici hook
 * @param {object} params.response { statusCode, headers, statusText }
 */
function requestHeadersHook(agent, { response }) {
  const { config } = agent
  const context = agent.tracer.getContext()
  const activeSegment = context?.extras?.undiciSegment
  const transaction = context?.transaction
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
 * @param {Agent} agent NR agent instance
 * @param {object} params object from undici hook
 * @param {Error} params.error error from undici request
 */
function endAndRestoreSegment(agent, { error }) {
  const { config } = agent
  const context = agent.tracer.getContext()
  const activeSegment = context?.extras?.undiciSegment
  const parentSegment = context?.extras?.undiciParent
  const tx = context?.transaction
  if (activeSegment) {
    activeSegment.end()
  }

  if (error && tx && config.feature_flag.undici_error_tracking === true) {
    handleError(agent, tx, error)
  }

  if (parentSegment) {
    agent.tracer.setSegment({ segment: parentSegment, transaction: tx })
  }
}

/**
 * Adds the error to the active transaction
 *
 * @param {Agent} agent NR agent instance
 * @param {Transaction} tx active transaction
 * @param {Error} error error from undici request
 */
function handleError(agent, tx, error) {
  logger.trace(error, 'Captured outbound error on behalf of the user.')
  agent.errors.add(tx, error)
}
