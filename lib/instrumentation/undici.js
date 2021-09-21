/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const recordExternal = require('../metrics/recorders/http_external')
const hashes = require('../util/hashes')
const logger = require('../logger').child({ component: 'undici' })
const NAMES = require('../metrics/names')

const NEWRELIC_ID_HEADER = 'x-newrelic-id'
const NEWRELIC_TRANSACTION_HEADER = 'x-newrelic-transaction'
const NEWRELIC_SYNTHETICS_HEADER = 'x-newrelic-synthetics'
const diagnosticsChannel = require('diagnostics_channel')
const SEGMENT = Symbol('__NR_segment')
const PARENT_SEGMENT = Symbol('__NR_parent_segment')
const { TLSSocket } = require('tls')

/**
 * Subscribes to undici diagnostic channel events
 *  `undici:request:create` - happens right before request is made
 *  `undici:request:headers` - happens when response headers are returned from server
 *  `undici:request:trailer` - happens right before response ends
 *  `undici:request:error` - happens when request errors
 *
 * @param {Agent} agent
 */
module.exports = function addUndiciChannels(agent, undici, modName, shim) {
  diagnosticsChannel.channel('undici:request:create').subscribe(({ request }) => {
    const parent = agent.tracer.getSegment()
    request[PARENT_SEGMENT] = parent
    if (parent && parent.opaque) {
      logger.trace(
        'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
        request.path,
        parent.name
      )

      return
    }

    const transaction = parent.transaction
    const outboundHeaders = Object.create(null)
    if (agent.config.encoding_key && transaction.syntheticsHeader) {
      outboundHeaders[NEWRELIC_SYNTHETICS_HEADER] = transaction.syntheticsHeader
    }

    if (agent.config.distributed_tracing.enabled) {
      transaction.insertDistributedTraceHeaders(outboundHeaders)
    } else if (agent.config.cross_application_tracer.enabled) {
      if (agent.config.encoding_key) {
        _addCATHeaders(agent, transaction, outboundHeaders)
      } else {
        logger.trace('No encoding key found, not adding CAT headers')
      }
    } else {
      logger.trace('CAT disabled, not adding headers!')
    }

    // eslint-disable-next-line guard-for-in
    for (const key in outboundHeaders) {
      request.addHeader(key, outboundHeaders[key])
    }
  })

  diagnosticsChannel.channel('undici:client:sendHeaders').subscribe(({ request, socket }) => {
    const parentSegment = request[PARENT_SEGMENT]
    if (parentSegment && parentSegment.opaque) {
      return
    }

    const port = socket.remotePort
    const isHttps = socket instanceof TLSSocket
    let urlString
    if (isHttps) {
      urlString = `https://${socket.servername}`
      urlString += port === 443 ? request.path : `:${port}${request.path}`
    } else {
      urlString = `http://${socket._host}`
      urlString += port === 80 ? request.path : `:${port}${request.path}`
    }

    const url = new URL(urlString)

    const name = NAMES.EXTERNAL.PREFIX + url.host + url.pathname
    const segment = agent.tracer.createSegment(
      name,
      recordExternal(url.host, 'undici'),
      request[PARENT_SEGMENT]
    )
    segment.start()
    shim.setActiveSegment(segment)
    segment.addAttribute('url', `${url.protocol}//${url.host}${url.pathname}`)

    url.searchParams.forEach((value, key) => {
      segment.addSpanAttribute(`request.parameters.${key}`, value)
    })
    segment.addAttribute('procedure', request.method || 'GET')
    request[SEGMENT] = segment
  })

  diagnosticsChannel.channel('undici:request:headers').subscribe(({ request, response }) => {
    const activeSegment = request[SEGMENT]
    if (activeSegment) {
      activeSegment.addSpanAttribute('http.statusCode', response.statusCode)
      activeSegment.addSpanAttribute('http.statusText', response.statusText)
      // If CAT is enabled, grab those headers!
      if (
        agent.config.cross_application_tracer.enabled &&
        !agent.config.distributed_tracing.enabled
      ) {
        pullCatHeaders(
          agent.config,
          activeSegment,
          request.origin,
          response.headers['x-newrelic-app-data']
        )
      }
    }
  })

  diagnosticsChannel.channel('undici:request:trailers').subscribe(({ request }) => {
    const activeSegment = request[SEGMENT]
    const parentSegment = request[PARENT_SEGMENT]
    if (activeSegment) {
      activeSegment.end()
      if (parentSegment) {
        shim.setActiveSegment(parentSegment)
      }
    }
  })

  diagnosticsChannel.channel('undici:request:error').subscribe(({ request, error }) => {
    const activeSegment = request[SEGMENT]
    const parentSegment = request[PARENT_SEGMENT]
    if (activeSegment) {
      activeSegment.end()
      // TODO: this is not IncomingMessage so has no listener count
      handleError(
        activeSegment,
        {
          listenerCount() {
            return 0
          }
        },
        error
      )
      if (parentSegment) {
        shim.setActiveSegment(parentSegment)
      }
    }
  })

  // TODO: no object to apply context to
  diagnosticsChannel.channel('undici:client:beforeConnect').subscribe(({ client }) => {
    const parent = agent.tracer.getSegment()
    const segment = agent.tracer.createSegment('undici.Client.connect')
    client[SEGMENT] = segment
    client[PARENT_SEGMENT] = parent
    segment.start()
    shim.setActiveSegment(segment)
  })

  diagnosticsChannel.channel('undici:client:connected').subscribe(({ client }) => {
    const segment = client[SEGMENT]
    const parent = client[PARENT_SEGMENT]
    if (segment) {
      segment.end()
      if (parent) {
        shim.setActiveSegment(parent)
      }
    }
  })

  diagnosticsChannel.channel('undici:client:connectError').subscribe(({ client, error }) => {
    const activeSegment = client[SEGMENT]
    const parentSegment = client[PARENT_SEGMENT]
    if (activeSegment) {
      activeSegment.end()
      // TODO: this is not IncomingMessage so has no listener count
      handleError(
        activeSegment,
        {
          listenerCount() {
            return 0
          }
        },
        error
      )
      if (parentSegment) {
        shim.setActiveSegment(parentSegment)
      }
    }
  })
}

/**
 * Notices the given error if there is no listener for the `error` event on the
 * request object.
 *
 * @param {TraceSegment} segment
 * @param {http.ClientRequest} req
 * @param {Error} error
 *
 * @return {bool} True if the error will be collected by New Relic.
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

function pullCatHeaders(config, segment, host, obfAppData) {
  if (!config.encoding_key) {
    logger.trace('config.encoding_key is not set - not parsing response CAT headers')
    return
  }

  if (!config.trusted_account_ids) {
    logger.trace('config.trusted_account_ids is not set - not parsing response CAT headers')
    return
  }

  // is our downstream request CAT-aware?
  if (!obfAppData) {
    logger.trace('Got no CAT app data in response header x-newrelic-app-data')
  } else {
    let appData = null
    try {
      appData = JSON.parse(hashes.deobfuscateNameUsingKey(obfAppData, config.encoding_key))
    } catch (e) {
      logger.warn('Got an unparsable CAT header x-newrelic-app-data: %s', obfAppData)
      return
    }
    // Make sure it is a trusted account
    if (appData.length && typeof appData[0] === 'string') {
      let accountId = appData[0].split('#')[0]
      accountId = parseInt(accountId, 10)
      if (config.trusted_account_ids.indexOf(accountId) === -1) {
        logger.trace('Response from untrusted CAT header account id: %s', accountId)
      } else {
        segment.catId = appData[0]
        segment.catTransaction = appData[1]
        segment.name =
          NAMES.EXTERNAL.TRANSACTION + host + '/' + segment.catId + '/' + segment.catTransaction
        if (appData.length >= 6) {
          segment.addAttribute('transaction_guid', appData[5])
        }
        logger.trace('Got inbound response CAT headers in transaction %s', segment.transaction.id)
      }
    }
  }
}

function _addCATHeaders(agent, tx, outboundHeaders) {
  if (agent.config.obfuscatedId) {
    outboundHeaders[NEWRELIC_ID_HEADER] = agent.config.obfuscatedId
  }

  const pathHash = hashes.calculatePathHash(
    agent.config.applications()[0],
    tx.getFullName() || '',
    tx.referringPathHash
  )
  tx.pushPathHash(pathHash)

  try {
    let txData = JSON.stringify([tx.id, false, tx.tripId || tx.id, pathHash])
    txData = hashes.obfuscateNameUsingKey(txData, agent.config.encoding_key)
    outboundHeaders[NEWRELIC_TRANSACTION_HEADER] = txData

    logger.trace('Added outbound request CAT headers in transaction %s', tx.id)
  } catch (err) {
    logger.trace(err, 'Failed to create CAT payload')
  }
}
