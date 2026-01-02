/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const cat = require('#agentlib/util/cat.js')
const recordExternal = require('#agentlib/metrics/recorders/http_external.js')
const NAMES = require('#agentlib/metrics/names.js')
const synthetics = require('#agentlib/synthetics.js')
const urltils = require('#agentlib/util/urltils.js')
const { undiciParent, undiciSegment } = require('#agentlib/symbols.js')
const DcBase = require('../dc-base')

class UndiciSubscriber extends DcBase {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'undici' })
    this.channels = [
      { channel: 'undici:request:create', hook: this.requestCreateHook },
      { channel: 'undici:request:headers', hook: this.requestHeadersHook },
      { channel: 'undici:request:trailers', hook: this.endAndRestoreSegment },
      { channel: 'undici:request:error', hook: this.endAndRestoreSegment }
    ]
  }

  /**
   * This event occurs after the Undici Request is created.
   * We will check current segment for opaque before creating the
   * external segment with the standard url/procedure/request.parameters
   * attributes.  We will also attach relevant DT headers to outgoing http request.
   *
   * @param {object} params object from undici hook
   * @param {object} params.request undici request object
   */
  requestCreateHook({ request }) {
    const agent = this.agent
    const context = agent.tracer.getContext()
    const { segment, transaction } = context
    request[undiciParent] = segment
    if (!(segment || transaction) || segment?.opaque) {
      this.logger.trace(
        'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
        request.path,
        segment?.name
      )

      return
    }

    try {
      this.createExternalSegment({ request, context })
      this.addDTHeaders({ transaction, request })
    } catch (err) {
      this.logger.warn(err, 'Unable to create external segment')
    }
  }

  /**
   * Injects relevant DT headers for the external request
   *
   * @param {object} params object to fn
   * @param {Shim} params.transaction current transaction
   * @param {object} params.request undici request object
   */
  addDTHeaders({ transaction, request }) {
    const outboundHeaders = Object.create(null)
    synthetics.assignHeadersToOutgoingRequest(this.config, transaction, outboundHeaders)

    if (this.config.distributed_tracing.enabled) {
      transaction.insertDistributedTraceHeaders(outboundHeaders)
    } else if (this.config.cross_application_tracer.enabled) {
      cat.addCatHeaders(this.config, transaction, outboundHeaders)
    } else {
      this.logger.trace('Both DT and CAT are disabled, not adding headers!')
    }

    for (const key in outboundHeaders) {
      request.addHeader(key, outboundHeaders[key])
    }
  }

  /**
   * Creates the external segment with url, procedure and request.parameters attributes
   *
   * @param {object} params object to fn
   * @param {object} params.context active context
   * @param {object} params.request undici request object
   */
  createExternalSegment({ request, context }) {
    const url = new URL(request.origin + request.path)
    const obfuscatedPath = urltils.obfuscatePath(this.config, url.pathname)
    const name = NAMES.EXTERNAL.PREFIX + url.host + obfuscatedPath
    const transaction = context?.transaction
    const parent = request[undiciParent]
    // Metrics for `External/<host>` will have a suffix of undici
    // We will have to see if this matters for people only using fetch
    // It's undici under the hood so ¯\_(ツ)_/¯
    const externalSegment = this.agent.tracer.createSegment({
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
      request[undiciSegment] = externalSegment
      this.agent.tracer.setSegment({ segment: externalSegment, transaction })
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
   * This event occurs after the response headers have been received.
   * We will add the relevant http response attributes to active segment.
   * Also add CAT specific keys to active segment.
   *
   * @param {object} params object from undici hook
   * @param {object} params.request undici request object
   * @param {object} params.response { statusCode, headers, statusText }
   */
  requestHeadersHook({ response, request }) {
    const context = this.agent.tracer.getContext()
    const activeSegment = request[undiciSegment]
    const transaction = context?.transaction
    if (!activeSegment) {
      return
    }

    activeSegment.addSpanAttribute('http.statusCode', response.statusCode)
    activeSegment.addSpanAttribute('http.statusText', response.statusText)

    if (this.config.cross_application_tracer.enabled && !this.config.distributed_tracing.enabled) {
      try {
        const { appData } = cat.extractCatHeaders(response.headers)
        const decodedAppData = cat.parseAppData(this.config, appData)
        const attrs = activeSegment.getAttributes()
        const url = new URL(attrs.url)
        cat.assignCatToSegment({
          appData: decodedAppData,
          segment: activeSegment,
          host: url.host,
          transaction
        })
      } catch (err) {
        this.logger.warn(err, 'Cannot add CAT data to segment')
      }
    }
  }

  /**
   * Gets the active segment, parent segment and transaction from given ctx(request, client connector)
   * and ends segment and sets the previous parent segment as the active segment.  If an error exists it will add the error to the transaction
   *
   * @param {object} params to function
   * @param {object} params.request undici request object
   * @param {Error} params.error error from undici request
   */
  endAndRestoreSegment({ error, request }) {
    const context = this.agent.tracer.getContext()
    const activeSegment = request[undiciSegment]
    const parentSegment = request[undiciParent]
    const tx = context?.transaction
    if (activeSegment) {
      activeSegment.end()
    }

    if (error && tx && this.config.feature_flag.undici_error_tracking === true) {
      this.logger.trace(error, 'Captured outbound error on behalf of the user.')
      this.agent.errors.add(tx, error)
    }

    if (parentSegment) {
      this.agent.tracer.setSegment({ segment: parentSegment, transaction: tx })
    }
  }
}

module.exports = UndiciSubscriber
