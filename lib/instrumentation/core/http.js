/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/* eslint sonarjs/cognitive-complexity: ["error", 42] -- TODO: https://issues.newrelic.com/browse/NEWRELIC-5252 */

const shimmer = require('../../shimmer')
const logger = require('../../logger').child({ component: 'http' })
const recordWeb = require('../../metrics/recorders/http')
const hashes = require('../../util/hashes')
const cat = require('../../util/cat')
const instrumentOutbound = require('./http-outbound')
const url = require('url')
const urltils = require('../../util/urltils')
const headerAttributes = require('../../header-attributes')
const headerProcessing = require('../../header-processing')

const NAMES = require('../../metrics/names')
const DESTS = require('../../config/attribute-filter').DESTINATIONS

const symbols = require('../../symbols')

/*
 *
 * CONSTANTS
 *
 */
const NEWRELIC_SYNTHETICS_HEADER = 'x-newrelic-synthetics'

// For incoming requests this instrumentation functions by wrapping
// `http.createServer` and `http.Server#addListener`. The former merely sets the
// agent dispatcher to 'http' and the latter wraps any event handlers bound to
// `request`.
//
// The `request` event listener wrapper creates a transaction proxy which will
// start a new transaction whenever a new request comes in. It also scans the
// headers of the incoming request looking for CAT and synthetics headers.

function wrapEmitWithTransaction(agent, emit, isHTTPS) {
  const tracer = agent.tracer
  const transport = isHTTPS ? 'HTTPS' : 'HTTP'
  let serverPort = null

  return tracer.transactionProxy(function wrappedHandler(evnt, request, response) {
    const transaction = tracer.getTransaction()
    if (!transaction) {
      return emit.apply(this, arguments)
    }

    transaction.nameState.setPrefix(NAMES.NODEJS.PREFIX)
    transaction.nameState.setDelimiter(NAMES.ACTION_DELIMITER)

    // Store the transaction information on the request and response.
    const txInfo = storeTxInfo(transaction, request, response)

    if (request) {
      initializeRequest(transaction, request)
    }

    // Create the transaction segment using the request URL for now. Once a
    // better name can be determined this segment will be renamed to that.
    const segment = tracer.createSegment(request.url, recordWeb)
    segment.start()

    if (request.method != null) {
      segment.addSpanAttribute('request.method', request.method)
    }

    if (txInfo) {
      // Seed segment stack to enable parenting logic leveraged by
      // web framework instrumentations.
      txInfo.segmentStack.push(segment)
    }

    transaction.type = 'web'
    transaction.baseSegment = segment

    /* Needed for Connect and Express middleware that monkeypatch request
     * and response via listeners.
     */
    tracer.bindEmitter(request, segment)
    tracer.bindEmitter(response, segment)

    // the error tracer needs a URL for tracing, even though naming overwrites
    transaction.parsedUrl = url.parse(request.url, true)
    transaction.url = urltils.obfuscatePath(agent.config, transaction.parsedUrl.pathname)
    transaction.verb = request.method

    // URL is sent as an agent attribute with transaction events
    transaction.trace.attributes.addAttribute(
      DESTS.TRANS_EVENT | DESTS.ERROR_EVENT,
      'request.uri',
      transaction.url
    )

    segment.addSpanAttribute('request.uri', transaction.url)

    // store the port on which this transaction runs
    if (this.address instanceof Function) {
      const address = this.address()
      if (address) {
        serverPort = address.port
      }
    }
    transaction.port = serverPort

    // need to set any config-driven names early for RUM
    logger.trace(
      { url: request.url, transaction: transaction.id },
      'Applying user naming rules for RUM.'
    )
    transaction.applyUserNamingRules(request.url)

    const queueTimeStamp = headerProcessing.getQueueTime(logger, request.headers)
    if (queueTimeStamp) {
      transaction.queueTime = Date.now() - queueTimeStamp
    }

    const synthHeader = request.headers[NEWRELIC_SYNTHETICS_HEADER]

    if (synthHeader && agent.config.trusted_account_ids && agent.config.encoding_key) {
      handleSyntheticsHeader(
        synthHeader,
        agent.config.encoding_key,
        agent.config.trusted_account_ids,
        transaction
      )
    }

    if (agent.config.distributed_tracing.enabled) {
      // Node http headers are automatically lowercase
      transaction.acceptDistributedTraceHeaders(transport, request.headers)
    } else if (agent.config.cross_application_tracer.enabled) {
      const { id, transactionId } = cat.extractCatHeaders(request.headers)
      const { externalId, externalTransaction } = cat.parseCatData(
        id,
        transactionId,
        agent.config.encoding_key
      )
      cat.assignCatToTransaction(externalId, externalTransaction, transaction)
    }

    function instrumentedFinish() {
      // Remove listeners so this doesn't get called twice.
      response.removeListener('finish', instrumentedFinish)
      response.removeListener('close', instrumentedFinish)

      // Naming must happen before the segment and transaction are ended,
      // because metrics recording depends on naming's side effects.
      transaction.finalizeNameFromUri(transaction.parsedUrl, response.statusCode)

      if (response) {
        if (response.statusCode != null) {
          const responseCode = String(response.statusCode)

          if (/^\d+$/.test(responseCode)) {
            transaction.trace.attributes.addAttribute(
              DESTS.TRANS_COMMON,
              'http.statusCode',
              responseCode
            )

            segment.addSpanAttribute('http.statusCode', responseCode)
          }
        }

        if (response.statusMessage !== undefined) {
          transaction.trace.attributes.addAttribute(
            DESTS.TRANS_COMMON,
            'http.statusText',
            response.statusMessage
          )

          segment.addSpanAttribute('http.statusText', response.statusMessage)
        }

        const headers = response.getHeaders()
        if (headers) {
          headerAttributes.collectResponseHeaders(headers, transaction)
        }
      }

      // And we are done! End the segment and transaction.
      segment.end()
      transaction.end()
    }
    response.once('finish', instrumentedFinish)
    response.once('close', instrumentedFinish)

    return tracer.bindFunction(emit, segment).apply(this, arguments)
  })
}

function storeTxInfo(transaction, request, response) {
  if (!request || !response) {
    logger.debug('Missing request or response object! Not storing transaction info.')
    return
  }

  const txInfo = {
    transaction: transaction,
    segmentStack: [],
    errorHandled: false,
    error: null
  }
  request[symbols.transactionInfo] = response[symbols.transactionInfo] = txInfo

  logger.trace('Stored transaction %s information on request and response', transaction.id)

  return txInfo
}

function initializeRequest(transaction, request) {
  headerAttributes.collectRequestHeaders(request.headers, transaction)

  if (request.method != null) {
    transaction.trace.attributes.addAttribute(DESTS.TRANS_COMMON, 'request.method', request.method)
    transaction.nameState.setVerb(request.method)
  }
}

function wrapResponseEnd(agent, proto) {
  const tracer = agent.tracer

  // On end, we must freeze the current name state to maintain the route that
  // responded and also end the current segment (otherwise it may become truncated).
  shimmer.wrapMethod(proto, 'Response.prototype', 'end', function wrapResEnd(end) {
    if (typeof end !== 'function') {
      logger.debug('Response#end is not a function?')
      return end
    }

    return function wrappedResEnd() {
      const txInfo = this && this[symbols.transactionInfo]
      if (!txInfo) {
        return end.apply(this, arguments)
      }

      if (!txInfo.transaction.isActive()) {
        logger.trace('wrappedResEnd invoked for ended transaction implying multiple invocations.')
        return end.apply(this, arguments)
      }

      // If an error happened, add it to the aggregator.
      if (
        txInfo.error &&
        (!txInfo.errorHandled || urltils.isError(agent.config, this.statusCode))
      ) {
        agent.errors.add(txInfo.transaction, txInfo.error)
      }

      // End all the segments leading up to and including this one.
      for (let i = txInfo.segmentStack.length - 1; i >= 0; --i) {
        txInfo.segmentStack[i].end()
      }
      const segment = tracer.getSegment()
      if (segment) {
        segment.end()
      }

      // Freeze the name state to prevent further changes.
      txInfo.transaction.nameState.freeze()

      return end.apply(this, arguments)
    }
  })
}

// CAT this won't be used unless CAT is enabled, see below where we actually do
// the shimmer stuff if you'd like to verify.
function wrapWriteHead(agent, writeHead) {
  return function wrappedWriteHead() {
    const transaction = agent.tracer.getTransaction()
    if (!transaction) {
      logger.trace('No transaction - not adding response CAT headers')
      return writeHead.apply(this, arguments)
    }
    if (transaction.syntheticsHeader) {
      this.setHeader(NEWRELIC_SYNTHETICS_HEADER, transaction.syntheticsHeader)
    }

    if (!transaction.incomingCatId) {
      logger.trace('No incoming CAT ID - not adding response CAT headers')
      return writeHead.apply(this, arguments)
    }

    if (!agent.config.trusted_account_ids) {
      logger.trace('No account IDs in config.trusted_account_ids - not adding response CAT headers')
      return writeHead.apply(this, arguments)
    }

    if (!cat.isTrustedAccountId(transaction.incomingCatId, agent.config.trusted_account_ids)) {
      return writeHead.apply(this, arguments)
    }

    // Not sure this could ever happen, but should guard against it anyway
    // otherwise exception we blow up the user's app.
    if (!agent.config.cross_process_id || !agent.config.encoding_key) {
      logger.trace(
        'Managed to have %s but not cross_process_id (%s) or encoding_key (%s) - %s',
        'agent.config.trusted_account_ids',
        agent.config.cross_process_id,
        agent.config.encoding_key,
        'not adding response CAT headers'
      )
      return writeHead.apply(this, arguments)
    }

    // -1 means no content length header was sent. We should only send this
    // value in the appData if the header is set.
    let contentLength = -1
    const newHeaders = arguments[arguments.length - 1]

    if (typeof newHeaders === 'object') {
      contentLength = headerProcessing.getContentLengthFromHeaders(newHeaders)
    }

    const currentHeaders = this.getHeaders()
    if (contentLength === -1 && currentHeaders) {
      contentLength = headerProcessing.getContentLengthFromHeaders(currentHeaders)
    }
    // Stored on the tx so we can push a metric with this time instead of
    // actual duration.
    transaction.catResponseTime = transaction.timer.getDurationInMillis()

    const { key, data } = cat.encodeAppData(agent.config, transaction, contentLength)
    if (key && data) {
      this.setHeader(key, data)
      logger.trace('Added outbound response CAT headers in transaction %s', transaction.id)
    }
    return writeHead.apply(this, arguments)
  }
}

// Taken from the Node code base, internal/url.js
function urlToOptions(_url) {
  const options = {
    protocol: _url.protocol,
    hostname:
      typeof _url.hostname === 'string' && _url.hostname.startsWith('[')
        ? _url.hostname.slice(1, -1)
        : _url.hostname,
    hash: _url.hash,
    search: _url.search,
    pathname: _url.pathname,
    path: `${_url.pathname || ''}${_url.search || ''}`,
    href: _url.href
  }
  if (_url.port !== '') {
    options.port = Number(_url.port)
  }
  if (_url.username || _url.password) {
    options.auth = `${_url.username}:${_url.password}`
  }
  return options
}

function wrapRequest(agent, request) {
  return function wrappedRequest(input, options, cb) {
    // If the first argument is a URL, merge it into the options object.
    // This code is copied from Node internals.
    if (typeof input === 'string') {
      const urlStr = input
      input = urlToOptions(new URL(urlStr))
    } else if (input.constructor && input.constructor.name === 'URL') {
      input = urlToOptions(input)
    } else {
      cb = options
      options = input
      input = null
    }

    if (typeof options === 'function') {
      cb = options
      options = input || {}
    } else {
      options = Object.assign(input || {}, options)
    }

    const reqArgs = [options, cb]

    // Don't pollute metrics and calls with NR connections
    const internalOnly = options && options[symbols.offTheRecord]
    if (internalOnly) {
      delete options[symbols.offTheRecord]
    }

    // If this is not a request we're recording, exit early.
    const transaction = agent.tracer.getTransaction()
    if (!transaction || internalOnly) {
      if (!internalOnly && logger.traceEnabled()) {
        const logOpts = typeof options === 'string' ? url.parse(options) : options
        logger.trace(
          'No transaction, not recording external to %s:%s',
          logOpts.hostname || logOpts.host,
          logOpts.port
        )
      }
      return request.apply(this, reqArgs)
    }

    const args = agent.tracer.slice(reqArgs)
    const context = this

    return instrumentOutbound(agent, options, function makeRequest(opts) {
      args[0] = opts
      return request.apply(context, args)
    })
  }
}

module.exports = function initialize(agent, http, moduleName) {
  if (!http) {
    logger.debug('Did not get http module, not instrumenting!')
    return false
  }

  const IS_HTTPS = moduleName === 'https'

  // FIXME: will this ever not be called?
  shimmer.wrapMethod(http, 'http', 'createServer', function wrapMethod(createServer) {
    // eslint-disable-next-line no-unused-vars
    return function setDispatcher(requestListener) {
      agent.environment.setDispatcher('http')
      return createServer.apply(this, arguments)
    }
  })

  // It's not a great idea to monkeypatch EventEmitter methods given how hot
  // they are, but this method is simple and works with all versions of node
  // supported by the module.
  shimmer.wrapMethod(
    http.Server && http.Server.prototype,
    'http.Server.prototype',
    'emit',
    function wrapEmit(emit) {
      const txStarter = wrapEmitWithTransaction(agent, emit, IS_HTTPS)
      return function wrappedEmit(evnt) {
        if (evnt === 'request') {
          return txStarter.apply(this, arguments)
        }
        return emit.apply(this, arguments)
      }
    }
  )

  wrapResponseEnd(agent, http.ServerResponse && http.ServerResponse.prototype)

  // If CAT is enabled we'll wrap `writeHead` to inject our headers.
  if (agent.config.cross_application_tracer.enabled) {
    shimmer.wrapMethod(
      http.ServerResponse && http.ServerResponse.prototype,
      'http.ServerResponse.prototype',
      'writeHead',
      wrapWriteHead.bind(null, agent)
    )
  }

  const agentProto = http && http.Agent && http.Agent.prototype

  shimmer.wrapMethod(http, 'http', 'request', wrapRequest.bind(null, agent))

  shimmer.wrapMethod(http, 'http', 'get', wrapRequest.bind(null, agent))

  shimmer.wrapMethod(
    agentProto,
    'http.Agent.prototype',
    'createConnection',
    function wrapCreateConnection(original) {
      return function wrappedCreateConnection() {
        if (!agent.getTransaction()) {
          return original.apply(this, arguments)
        }

        const segment = agent.tracer.createSegment('http.Agent#createConnection')

        const args = agent.tracer.slice(arguments)
        if (typeof args[1] === 'function') {
          args[1] = agent.tracer.bindFunction(args[1], segment, true)
        }

        return agent.tracer.bindFunction(original, segment, true).apply(this, args)
      }
    }
  )
}

/**
 * Take the X-NewRelic-Synthetics header and apply any appropriate data to the
 * transaction for later use. This is the gate keeper for attributes being
 * added onto the transaction object for synthetics.
 *
 * @param {string} header - The raw X-NewRelic-Synthetics header
 * @param {string} encKey - Encoding key handed down from the server
 * @param {Array.<number>} trustedIds - Array of accounts to trust the header from.
 * @param {object} transaction - Where the synthetics data is attached to.
 */
function handleSyntheticsHeader(header, encKey, trustedIds, transaction) {
  const synthData = parseSyntheticsHeader(header, encKey, trustedIds)
  if (!synthData) {
    return
  }

  transaction.syntheticsData = synthData
  transaction.syntheticsHeader = header
}

/**
 * Parse out and verify the the pieces of the X-NewRelic-Synthetics header.
 *
 * @param {string} header - The raw X-NewRelic-Synthetics header
 * @param {string} encKey - Encoding key handed down from the server
 * @param {Array.<number>} trustedIds - Array of accounts to trust the header from.
 * @returns {object | null} - On successful parse and verification an object of
 *                            synthetics data is returned, otherwise null is
 *                            returned.
 */
function parseSyntheticsHeader(header, encKey, trustedIds) {
  // Eagerly declare this object because we know what it should look like and
  // can use that for header verification.
  const parsedData = {
    version: null,
    accountId: null,
    resourceId: null,
    jobId: null,
    monitorId: null
  }
  let synthData = null
  try {
    synthData = JSON.parse(hashes.deobfuscateNameUsingKey(header, encKey))
  } catch (e) {
    logger.trace(e, 'Got unparsable synthetics header: %s', header)
    return
  }

  if (!Array.isArray(synthData)) {
    logger.trace('Synthetics data is not an array: %s (%s)', synthData, typeof synthData)
    return
  }

  if (synthData.length < Object.keys(parsedData).length) {
    logger.trace(
      'Synthetics header length is %s, expected at least %s',
      synthData.length,
      Object.keys(parsedData).length
    )
  }

  parsedData.version = synthData[0]
  if (parsedData.version !== 1) {
    logger.trace('Synthetics header version is not 1, got: %s (%s)', parsedData.version, synthData)
    return
  }

  parsedData.accountId = synthData[1]
  if (parsedData.accountId) {
    if (trustedIds.indexOf(parsedData.accountId) === -1) {
      logger.trace(
        'Synthetics header account ID is not in trusted account IDs: %s (%s)',
        parsedData.accountId,
        trustedIds
      )
      return
    }
  } else {
    logger.trace('Synthetics header account ID missing.')
    return
  }

  parsedData.resourceId = synthData[2]
  if (!parsedData.resourceId) {
    logger.trace('Synthetics resource ID is missing.')
    return
  }

  parsedData.jobId = synthData[3]
  if (!parsedData.jobId) {
    logger.trace('Synthetics job ID is missing.')
  }

  parsedData.monitorId = synthData[4]
  if (!parsedData.monitorId) {
    logger.trace('Synthetics monitor ID is missing.')
  }

  return parsedData
}
