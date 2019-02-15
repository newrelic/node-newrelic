'use strict'

const shimmer = require('../../shimmer')
const logger = require('../../logger').child({component: 'http'})
const recordWeb = require('../../metrics/recorders/http')
const hashes = require('../../util/hashes')
const cat = require('../../util/cat')
const instrumentOutbound = require('./http-outbound')
const util = require('util')
const url = require('url')
const urltils = require('../../util/urltils')
const properties = require('../../util/properties')
const psemver = require('../../util/process-version')
const headerAttributes = require('../../header-attributes')

const NAMES = require('../../metrics/names')
const DESTS = require('../../config/attribute-filter').DESTINATIONS

/*
 *
 * CONSTANTS
 *
 */
const SHOULD_WRAP_HTTPS = psemver.satisfies('>=9.0.0 || 8.9.0')
const NR_CONNECTION_PROP = '__NR__connection'
const REQUEST_HEADER = 'x-request-start'
const QUEUE_HEADER = 'x-queue-start'
const NEWRELIC_ID_HEADER = 'x-newrelic-id'
const NEWRELIC_APP_DATA_HEADER = 'x-newrelic-app-data'
const NEWRELIC_TRACE_HEADER = 'newrelic'
const NEWRELIC_TRANSACTION_HEADER = 'x-newrelic-transaction'
const NEWRELIC_SYNTHETICS_HEADER = 'x-newrelic-synthetics'
const CONTENT_LENGTH_REGEX = /^Content-Length$/i
const TRANSACTION_INFO_KEY = '__NR_transactionInfo'


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
    var transaction = tracer.getTransaction()
    if (!transaction) return emit.apply(this, arguments)

    transaction.nameState.setPrefix(NAMES.NODEJS.PREFIX)
    transaction.nameState.setDelimiter(NAMES.ACTION_DELIMITER)

    // Store the transaction information on the request and response.
    storeTxInfo(transaction, request, response)

    // Hook for web framework instrumentations that don't have easy access to
    // the request entry point.
    if (properties.hasOwn(this, '__NR_onRequestStarted')) {
      this.__NR_onRequestStarted(request, response)
    }

    if (request) {
      initializeRequest(transaction, request)
    }

    // Create the transaction segment using the request URL for now. Once a
    // better name can be determined this segment will be renamed to that.
    var segment = tracer.createSegment(request.url, recordWeb)
    segment.start()

    transaction.type = 'web'
    transaction.baseSegment = segment

    /* Needed for Connect and Express middleware that monkeypatch request
     * and response via listeners.
     */
    tracer.bindEmitter(request, segment)
    tracer.bindEmitter(response, segment)

    // the error tracer needs a URL for tracing, even though naming overwrites
    transaction.parsedUrl = url.parse(request.url, true)
    transaction.url = transaction.parsedUrl.pathname
    transaction.verb = request.method

    // URL is sent as an agent attribute with transaction events
    transaction.trace.attributes.addAttribute(
      DESTS.TRANS_EVENT | DESTS.ERROR_EVENT,
      'request.uri',
      transaction.url
    )

    // store the port on which this transaction runs
    if (this.address instanceof Function) {
      var address = this.address()
      if (address) {
        serverPort = address.port
      }
    }
    transaction.port = serverPort

    // need to set any config-driven names early for RUM
    logger.trace({url: request.url, transaction: transaction.id},
      'Applying user naming rules for RUM.')
    transaction.applyUserNamingRules(request.url)

    /**
     * Calculate Queue Time
     *
     * Queue time is provided by certain providers by stamping the request
     * header with the time the request arrived at the router.
     *
     * Units for queue time are
     */
    var qtime = request.headers[REQUEST_HEADER] || request.headers[QUEUE_HEADER]
    if (qtime) {
      var split = qtime.split('=')
      if (split.length > 1) {
        qtime = split[1]
      }

      var start = parseFloat(qtime)

      if (isNaN(start)) {
        logger.warn('Queue time header parsed as NaN (%s)', qtime)
      } else {
        // nano seconds
        if (start > 1e18) start = start / 1e6
        // micro seconds
        else if (start > 1e15) start = start / 1e3
        // seconds
        else if (start < 1e12) start = start * 1e3

        transaction.queueTime = Date.now() - start
      }
    }

    if (agent.config.distributed_tracing.enabled) {
      const payload = request.headers[NEWRELIC_TRACE_HEADER]
      if (payload) {
        logger.trace(
          'Accepting distributed trace payload for transaction %s',
          transaction.id
        )
        transaction.acceptDistributedTracePayload(payload, transport)
      }
    } else if (agent.config.cross_application_tracer.enabled) {
      var encKey = agent.config.encoding_key
      var incomingCatId = request.headers[NEWRELIC_ID_HEADER]
      var obfTransaction = request.headers[NEWRELIC_TRANSACTION_HEADER]
      var synthHeader = request.headers[NEWRELIC_SYNTHETICS_HEADER]
      if (encKey) {
        cat.handleCatHeaders(incomingCatId, obfTransaction, encKey, transaction)
        if (transaction.incomingCatId) {
          logger.trace('Got inbound request CAT headers in transaction %s',
            transaction.id)
        }
        if (synthHeader && agent.config.trusted_account_ids) {
          handleSyntheticsHeader(
            synthHeader,
            encKey,
            agent.config.trusted_account_ids,
            transaction
          )
        }
      }
    }

    function instrumentedFinish() {
      // Remove listeners so this doesn't get called twice.
      response.removeListener('finish', instrumentedFinish)
      request.removeListener('aborted', instrumentedFinish)

      // Naming must happen before the segment and transaction are ended,
      // because metrics recording depends on naming's side effects.
      transaction.finalizeNameFromUri(transaction.parsedUrl, response.statusCode)

      if (response) {
        if (response.statusCode != null) {
          var responseCode = String(response.statusCode)
          transaction.trace.attributes.addAttribute(
            DESTS.TRANS_COMMON,
            'httpResponseCode',
            responseCode
          )

          if (/^\d+$/.test(responseCode)) {
            transaction.trace.attributes.addAttribute(
              DESTS.TRANS_COMMON,
              'response.status',
              responseCode
            )
          }
        }
        if (response.statusMessage !== undefined) {
          transaction.trace.attributes.addAttribute(
            DESTS.TRANS_COMMON,
            'httpResponseMessage',
            response.statusMessage
          )
        }

        // TODO: Just use `getHeaders()` after deprecating Node <7.7.
        var headers = (response.getHeaders && response.getHeaders()) || response._headers
        if (headers) {
          headerAttributes.collectResponseHeaders(headers, transaction)
        }
      }

      // And we are done! End the segment and transaction.
      segment.end()
      transaction.end()
    }
    response.once('finish', instrumentedFinish)
    request.once('aborted', instrumentedFinish)

    return tracer.bindFunction(emit, segment).apply(this, arguments)
  })
}

function storeTxInfo(transaction, request, response) {
  if (!request || !response) {
    logger.debug('Missing request or response object! Not storing transaction info.')
    return
  }
  var hideInternal = transaction.agent.config.transaction_tracer.hide_internals

  var txInfo = {
    transaction: transaction,
    segmentStack: [],
    errorHandled: false,
    error: null
  }
  if (hideInternal) {
    properties.setInternal(request, TRANSACTION_INFO_KEY, txInfo)
    properties.setInternal(response, TRANSACTION_INFO_KEY, txInfo)
  } else {
    request[TRANSACTION_INFO_KEY] = response[TRANSACTION_INFO_KEY] = txInfo
  }

  logger.trace(
    'Stored transaction %s information on request and response',
    transaction.id
  )
}

function initializeRequest(transaction, request) {
  headerAttributes.collectRequestHeaders(request.headers, transaction)

  if (request.method != null) {
    transaction.trace.attributes.addAttribute(
      DESTS.TRANS_COMMON,
      'request.method',
      request.method
    )
    transaction.nameState.setVerb(request.method)
  }
}

function wrapResponseEnd(agent, proto) {
  var tracer = agent.tracer

  // On end, we must freeze the current name state to maintain the route that
  // responded and also end the current segment (otherwise it may become truncated).
  shimmer.wrapMethod(proto, 'Response.prototype', 'end', function wrapResEnd(end) {
    if (typeof end !== 'function') {
      logger.debug('Response#end is not a function?')
      return end
    }

    return function wrappedResEnd() {
      var txInfo = this && this[TRANSACTION_INFO_KEY]
      if (!txInfo) {
        return end.apply(this, arguments)
      }

      // If an error happend, add it to the aggregator.
      if (txInfo.error) {
        if (!txInfo.errorHandled || urltils.isError(agent.config, this.statusCode)) {
          agent.errors.add(txInfo.transaction, txInfo.error)
        }
      }

      // End all the segments leading up to and including this one.
      for (var i = txInfo.segmentStack.length - 1; i >= 0; --i) {
        txInfo.segmentStack[i].end()
      }
      var segment = tracer.getSegment()
      if (segment) {
        segment.end()
      }

      // Freeze the name state to prevent further changes.
      txInfo.transaction.nameState.freeze()

      return end.apply(this, arguments)
    }
  })
}

// CAT this wont be used unless CAT is enabled, see below where we actually do
// the shimmer stuff if you'd like to verify.
function wrapWriteHead(agent, writeHead) {
  return function wrappedWriteHead() {
    var transaction = agent.tracer.getTransaction()
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
      logger.trace(
        'No account IDs in config.trusted_account_ids - not adding response CAT headers'
      )
      return writeHead.apply(this, arguments)
    }

    var accountId = transaction.incomingCatId.split('#')[0]
    accountId = parseInt(accountId, 10)
    if (agent.config.trusted_account_ids.indexOf(accountId) === -1) {
      logger.trace(
        'Request from untrusted account id: %s - not adding response CAT headers',
        accountId
      )
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
    var contentLength = -1
    var new_headers = arguments[arguments.length - 1]

    if (typeof new_headers === 'object') {
      for (var header in new_headers) {  // jshint ignore: line
        if (CONTENT_LENGTH_REGEX.test(header)) {
          contentLength = new_headers[header]
          break
        }
      }
    }

    if (contentLength === -1 && this._headers) {
      // JSHint complains about ownProperty stuff, but since we are looking
      // for a specific name that doesn't matter so I'm disabling it.
      // Outbound headers can be capitalized in any way, use regex instead
      // of direct lookup.
      for (var userHeader in this._headers) {  // jshint ignore: line
        if (CONTENT_LENGTH_REGEX.test(userHeader)) {
          contentLength = this._headers[userHeader]
          break
        }
      }
    }
    // Stored on the tx so we can push a metric with this time instead of
    // actual duration.
    transaction.catResponseTime = transaction.timer.getDurationInMillis()

    var appData = null
    var txName = transaction.getFullName() || ''

    try {
      appData = JSON.stringify([
        agent.config.cross_process_id, // cross_process_id
        txName, // transaction name
        transaction.queueTime / 1000, // queue time (s)
        transaction.catResponseTime / 1000, // response time (s)
        contentLength, // content length (if content-length header is also being sent)
        transaction.id, // TransactionGuid
        false // force a transaction trace to be recorded
      ])
    } catch (err) {
      logger.trace(
        err,
        'Failed to serialize transaction: %s - not adding CAT response headers',
        txName
      )
      return writeHead.apply(this, arguments)
    }

    var encKey = agent.config.encoding_key
    var obfAppData = hashes.obfuscateNameUsingKey(appData, encKey)
    this.setHeader(NEWRELIC_APP_DATA_HEADER, obfAppData)
    logger.trace('Added outbound response CAT headers in transaction %s', transaction.id)

    return writeHead.apply(this, arguments)
  }
}

function wrapRequest(agent, request) {
  return function wrappedRequest(options) {
    // Don't pollute metrics and calls with NR connections
    const internalOnly = options && options[NR_CONNECTION_PROP]
    if (internalOnly) {
      delete options[NR_CONNECTION_PROP]
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
      return request.apply(this, arguments)
    }

    const args = agent.tracer.slice(arguments)
    const context = this

    // hostname & port logic pulled directly from node's 0.10 lib/http.js
    return instrumentOutbound(agent, options, function makeRequest(opts) {
      args[0] = opts
      return request.apply(context, args)
    })
  }
}

function wrapLegacyRequest(agent, request) {
  return function wrappedLegacyRequest(method, path, headers) {
    var makeRequest = request.bind(this, method, path, headers)

    if (agent.tracer.getTransaction()) {
      return instrumentOutbound(agent, this, makeRequest)
    }

    logger.trace('No transaction, not recording external to %s:%s', this.host, this.port)
    return makeRequest()
  }
}

function wrapLegacyClient(agent, proto) {
  shimmer.wrapMethod(
    proto,
    'http.Client.prototype',
    'request',
    wrapLegacyRequest.bind(null, agent)
  )
}

module.exports = function initialize(agent, http, moduleName) {
  if (!http) {
    logger.debug('Did not get http module, not instrumenting!')
    return false
  }

  const IS_HTTPS = moduleName === 'https'

  // FIXME: will this ever not be called?
  shimmer.wrapMethod(http, 'http', 'createServer', function cb_wrapMethod(createServer) {
    return function setDispatcher(requestListener) { // eslint-disable-line no-unused-vars
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
      var txStarter = wrapEmitWithTransaction(agent, emit, IS_HTTPS)
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

  var agentProto = http && http.Agent && http.Agent.prototype

  // As of node 0.8, http.request() is the right way to originate outbound
  // requests. From 0.11 until 9, the `https` module simply called through to
  // the `http` methods, so to prevent double-instrumenting we need to check
  // what module we're instrumenting and what version of Node we're on. This
  // change originally also appeared in 8.9.0 but was reverted in 8.9.1.
  //
  // TODO: Remove `SHOULD_WRAP_HTTPS` after deprecating Node <9.
  if (SHOULD_WRAP_HTTPS || !IS_HTTPS) {
    shimmer.wrapMethod(
      http,
      'http',
      'request',
      wrapRequest.bind(null, agent)
    )

    // Upon updating to https-proxy-agent v2, we are now using
    // agent-base v4, which patches https.get to use https.request.
    //
    // https://github.com/TooTallNate/node-agent-base/commit/7de92df780e147d4618
    //
    // This means we need to skip instrumenting to avoid double
    // instrumenting external requests.
    if (!IS_HTTPS && psemver.satisfies('>=8')) {
      shimmer.wrapMethod(
        http,
        'http',
        'get',
        wrapRequest.bind(null, agent)
      )
    }
  }

  shimmer.wrapMethod(
    agentProto,
    'http.Agent.prototype',
    'createConnection',
    function wrapCreateConnection(original) {
      return function wrappedCreateConnection() {
        if (!agent.getTransaction()) {
          return original.apply(this, arguments)
        }

        var segment = agent.tracer.createSegment('http.Agent#createConnection')

        var args = agent.tracer.slice(arguments)
        if (typeof args[1] === 'function') {
          args[1] = agent.tracer.bindFunction(args[1], segment, true)
        }

        var sock = agent.tracer.bindFunction(original, segment, true).apply(this, args)
        return sock
      }
    }
  )

  // http.Client is deprecated, but still in use
  // TODO: Remove this once Node <7 is deprecated.
  var DeprecatedClient, deprecatedCreateClient
  function clearGetters() {
    if (DeprecatedClient) {
      delete http.Client
      http.Client = DeprecatedClient
    }
    if (deprecatedCreateClient) {
      delete http.createClient
      http.createClient = deprecatedCreateClient
    }
  }

  // TODO: Remove this once Node <7 is deprecated.
  DeprecatedClient = shimmer.wrapDeprecated(
    http,
    'http',
    'Client',
    {
      get: function get() {
        var example = new DeprecatedClient(80, 'localhost')
        wrapLegacyClient(agent, example.constructor.prototype)
        clearGetters()

        return DeprecatedClient
      },
      set: function set(NewClient) {
        DeprecatedClient = NewClient
      }
    }
  )

  // TODO: Remove this once Node <7 is deprecated.
  deprecatedCreateClient = shimmer.wrapDeprecated(
    http,
    'http',
    'createClient',
    {
      get: function get() {
        var example = deprecatedCreateClient(80, 'localhost')
        wrapLegacyClient(agent, example.constructor.prototype)
        clearGetters()

        return deprecatedCreateClient
      },
      set: function set(newCreateClient) {
        deprecatedCreateClient = newCreateClient
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
 * @param {Transaction} transaction - Where the synthetics data is attached to.
 */
function handleSyntheticsHeader(header, encKey, trustedIds, transaction) {
  var synthData = parseSyntheticsHeader(header, encKey, trustedIds)
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
 * @return {Object|null} - On successful parse and verification an object of
 *                            synthetics data is returned, otherwise null is
 *                            returned.
 */
function parseSyntheticsHeader(header, encKey, trustedIds) {
  // Eagerly declare this object because we know what it should look like and
  // can use that for header verification.
  var parsedData = {
    version: null,
    accountId: null,
    resourceId: null,
    jobId: null,
    monitorId: null
  }
  var synthData = null
  try {
    synthData = JSON.parse(
      hashes.deobfuscateNameUsingKey(header, encKey)
    )
  } catch (e) {
    logger.trace(e, 'Got unparsable synthetics header: %s', header)
    return
  }

  if (!util.isArray(synthData)) {
    logger.trace(
      'Synthetics data is not an array: %s (%s)',
      synthData,
      typeof synthData
    )
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
    logger.trace(
      'Synthetics header version is not 1, got: %s (%s)',
      parsedData.version,
      synthData
    )
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
