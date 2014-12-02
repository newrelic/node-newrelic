'use strict'

var shimmer = require('../../shimmer.js')
var logger = require('../../logger').child({component : 'http'})
var recordWeb = require('../../metrics/recorders/http.js')
var hashes = require('../../util/hashes.js')
var instrumentOutbound = require('../../transaction/tracer/instrumentation/outbound.js')
var util = require('util')
var url = require('url')

/*
 *
 * CONSTANTS
 *
 */
var NR_CONNECTION_PROP = '__NR__connection'
var DEFAULT_HOST = 'localhost'
var DEFAULT_PORT = 80
var REQUEST_HEADER = 'x-request-start'
var QUEUE_HEADER = 'x-queue-start'
var NEWRELIC_ID_HEADER = 'x-newrelic-id'
var NEWRELIC_APP_DATA_HEADER = 'x-newrelic-app-data'
var NEWRELIC_TRANSACTION_HEADER = 'x-newrelic-transaction'
var CONTENT_LENGTH_REGEX = /^Content-Length$/i


function wrapListener(agent, listener) {
  if (!listener) throw new Error("No request listener defined, so nothing to do.")

  var tracer = agent.tracer

  return tracer.transactionProxy(function wrappedHandler(request, response) {
    if (!tracer.getTransaction()) return listener.apply(this, arguments)

    /* Needed for Connect and Express middleware that monkeypatch request
     * and response via listeners.
     */
    tracer.bindEmitter(request)
    tracer.bindEmitter(response)

    var transaction = tracer.getTransaction()
      , segment     = tracer.addSegment(request.url, recordWeb)

    if (agent.config.feature_flag.custom_instrumentation) {
      transaction.webSegment = segment
    }

    // the error tracer needs a URL for tracing, even though naming overwrites
    transaction.url  = request.url
    transaction.verb = request.method

    // need to set any config-driven names early for RUM
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
        logger.warn('Queue time header parsed as NaN (' + qtime + ')')
      }
      else {
        if (start > 1e18) start = start / 1e6; // nano seconds
        else if (start > 1e15) start = start / 1e3; // micro seconds
        else if (start < 1e12) start = start * 1e3; // seconds

        transaction.queueTime = Date.now() - start
      }
    }

    if (agent.config.feature_flag.cat) {
      var encKey = agent.config.encoding_key
      var incomingCatId = request.headers[NEWRELIC_ID_HEADER]
      var obfTransaction = request.headers[NEWRELIC_TRANSACTION_HEADER]
      if (encKey) {
        if (incomingCatId) {
          transaction.incomingCatId = hashes.deobfuscateNameUsingKey(incomingCatId,
                                                                     encKey)
        }
        if (obfTransaction) {
          var externalTrans = null
          try {
            externalTrans = JSON.parse(hashes.deobfuscateNameUsingKey(obfTransaction,
                                                                      encKey))
          } catch (e) {
            logger.warn('Got an unparsable CAT header x-newrelic-transaction: %s',
                        obfTransaction)
          }
          if (externalTrans) {
            transaction.referringTransactionGuid = externalTrans[0]
            transaction.tripId = externalTrans[2]

            if (_isValidReferringHash(externalTrans[3])) {
              transaction.referringPathHash = externalTrans[3]
            }
          }
        }
      }
    }

    function instrumentedFinish() {
      /* Express breaks URLs up by application, but the unmodified URL can be
       * recovered from the request via request.originalUrl.
       */
      var url = request.originalUrl || request.url

      /* Naming must happen before the segment and transaction are ended,
       * because metrics recording depends on naming's side effects.
       */
      transaction.setName(url, response.statusCode)

      // This should be the last thing called before the web segment finishes.
      segment.markAsWeb(url)

      segment.end()
      transaction.end()
    }
    response.once('finish', instrumentedFinish)

    return listener.apply(this, arguments)
  })
}

// FLAG: cat this wont be used unless cat is enabled, see below where we
// actually do the shimmer stuff if you'd like to verify.
function wrapWriteHead(agent, writeHead) {
  return function wrappedWriteHead() {
    var transaction = agent.tracer.getTransaction()
    if (!transaction || !transaction.incomingCatId || !agent.config.trusted_account_ids) {
      return writeHead.apply(this, arguments)
    }
    var accountId = transaction.incomingCatId.split('#')[0]
    accountId = parseInt(accountId, 10)
    if (agent.config.trusted_account_ids.indexOf(accountId) === -1) {
      logger.trace('Request from untrusted CAT header account id: %s', accountId)
      return writeHead.apply(this, arguments)
    }

    // Not sure this could ever happen, but should guard against it anyway
    // otherwise exception we blow up the user's app.
    if (!agent.config.cross_process_id || !agent.config.encoding_key) {
      logger.trace('Managed to have agent.config.trusted_account_ids but not cross_process_id (%s) or encoding_key (%s)',
                   agent.config.cross_process_id, agent.config.encoding_key)
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
      for (var header in this._headers) {  // jshint ignore: line
        if (CONTENT_LENGTH_REGEX.test(header)) {
          contentLength = this._headers[header]
          break
        }
      }
    }
    // Stored on the tx so we can push a metric with this time instead of
    // actual duration.
    transaction.catResponseTime = transaction.timer.getDurationInMillis()

    var appData = JSON.stringify([
      agent.config.cross_process_id, // cross_process_id
      transaction.name || transaction.partialName, // transaction name
      transaction.queueTime / 1000, // queue time (s)
      transaction.catResponseTime / 1000, // response time (s)
      contentLength, // content length (if content-length header is also being sent)
      transaction.id, // TransactionGuid
      false // force a transaction trace to be recorded
    ])

    var encKey = agent.config.encoding_key
    var obfAppData = hashes.obfuscateNameUsingKey(appData, encKey)
    this.setHeader(NEWRELIC_APP_DATA_HEADER, obfAppData)

    return writeHead.apply(this, arguments)
  }
}

function wrapRequest(agent, request) {
  return agent.tracer.segmentProxy(function wrappedRequest(options, callback) {
    if (callback && typeof callback === 'function') {
      // want to bind callback into request regardless of current state
      callback = agent.tracer.callbackProxy(callback)
    }
    var transaction = agent.tracer.getTransaction()
    var outboundHeaders = {}

    // don't pollute metrics and calls with NR connections
    var internalOnly = options && options[NR_CONNECTION_PROP]

    if (internalOnly) options[NR_CONNECTION_PROP] = undefined
    else {
      // FLAG: cat

      if (agent.config.feature_flag.cat && transaction) {
        if (agent.config.obfuscatedId) {
          outboundHeaders[NEWRELIC_ID_HEADER] = agent.config.obfuscatedId
        }
        if (agent.config.encoding_key) {
          var pathHash = hashes.calculatePathHash(agent.config.applications()[0], transaction.name || transaction.partialName, transaction.referringPathHash)
          transaction.pushPathHash(pathHash)
          var txData = [
            transaction.id,
            false,
            transaction.tripId || transaction.id,
            pathHash,
          ]
          txData = JSON.stringify(txData)
          var txHeader = hashes.obfuscateNameUsingKey(txData, agent.config.encoding_key)
          outboundHeaders[NEWRELIC_TRANSACTION_HEADER] = txHeader
        }
      }
    }

    var headers = Object.keys(outboundHeaders)
    var requested

    if (transaction && !internalOnly) {
      if (util.isArray(options.headers)) {
        options = util._extend({}, options)
        options.headers = options.headers.slice()
        for (var i = 0, l = headers.length; i < l; ++i) {
          options.headers.push([headers[i], outboundHeaders[headers[i]]])
        }
      } else if (typeof options === 'object' && options.headers && options.headers.expect) {
        options = util._extend({}, options)
        options.headers = util._extend({}, options.headers)
        options.headers = util._extend(options.headers, outboundHeaders)
      } else {
        requested = request.call(this, options, callback)
        for (var i = 0, l = headers.length; i < l; ++i) {
          requested.setHeader(headers[i], outboundHeaders[headers[i]])
        }
      }

      requested = requested || request.call(this, options, callback)

      var request_url = options
      // If the request options are a string, parse it as a URL object.
      if (typeof options === 'string') {
        request_url = url.parse(options)
      }
      // hostname & port logic pulled directly from node's 0.10 lib/http.js
      var hostname = request_url.hostname || request_url.host || DEFAULT_HOST
      var port = request_url.port || request_url.defaultPort || DEFAULT_PORT
      instrumentOutbound(agent, requested, hostname, port)
    }

    return requested || request.call(this, options, callback)
  })
}

function wrapLegacyRequest(agent, request) {
  return agent.tracer.segmentProxy(function wrappedLegacyRequest(method, path, headers) {
    var requested = request.call(this, method, path, headers)

    if (agent.tracer.getTransaction()) {
      instrumentOutbound(agent, requested, this.host, this.port)
    }

    return requested
  })
}

function wrapLegacyClient(agent, proto) {
  shimmer.wrapMethod(
    proto,
    'http.Client.prototype',
    'request',
    wrapLegacyRequest.bind(null, agent)
  )
}

module.exports = function initialize(agent, http) {
  // FIXME: will this ever not be called?
  shimmer.wrapMethod(http, 'http', 'createServer', function cb_wrapMethod(createServer) {
    return function setDispatcher(requestListener) {
      /*jshint unused:false */
      agent.environment.setDispatcher('http')
      return createServer.apply(this, arguments)
    }
  })

  /**
   * It's not a great idea to monkeypatch EventEmitter methods given how hot
   * they are, but this method is simple and works with all versions of
   * node supported by the module.
   */
  shimmer.wrapMethod(
    http && http.Server && http.Server.prototype,
    'http.Server.prototype',
    ['on', 'addListener'],
    function cb_wrapMethod(addListener) {
      return function cls_wrapMethod(type, listener) {
        if (type === 'request' && typeof listener === 'function') {
          return addListener.call(this, type, wrapListener(agent, listener))
        } else {
          return addListener.apply(this, arguments)
        }
      }
    }
  )


  // FLAG: cat
  if (agent.config.feature_flag.cat) {
    shimmer.wrapMethod(http && http.ServerResponse && http.ServerResponse.prototype,
                       'http.ServerResponse.prototype',
                       'writeHead',
                       wrapWriteHead.bind(null, agent))
  }

  /**
   * As of node 0.8, http.request() is the right way to originate outbound
   * requests.
   */
  if (http && http.Agent && http.Agent.prototype && http.Agent.prototype.request) {
    // Node 0.11+ always uses an Agent.
    shimmer.wrapMethod(
      http.Agent.prototype,
      'http.Agent.prototype',
      'request',
      wrapRequest.bind(null, agent)
    )
  }
  else {
    shimmer.wrapMethod(
      http,
      'http',
      'request',
      wrapRequest.bind(null, agent)
    )
  }

  // http.Client is deprecated, but still in use
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

  DeprecatedClient = shimmer.wrapDeprecated(
    http,
    'http',
    'Client',
    {
      get : function get() {
        var example = new DeprecatedClient(80, 'localhost')
        wrapLegacyClient(agent, example.constructor.prototype)
        clearGetters()

        return DeprecatedClient
      },
      set : function set(NewClient) {
        DeprecatedClient = NewClient
      }
    }
  )

  deprecatedCreateClient = shimmer.wrapDeprecated(
    http,
    'http',
    'createClient',
    {
      get : function get() {
        var example = deprecatedCreateClient(80, 'localhost')
        wrapLegacyClient(agent, example.constructor.prototype)
        clearGetters()

        return deprecatedCreateClient
      },
      set : function set(newCreateClient) {
        deprecatedCreateClient = newCreateClient
      }
    }
  )
}

// Export this function for use in unit tests
var VALID_REFERRING_HASH_RE = /^[0-9a-f]{0,8}$/i
function _isValidReferringHash(hash) {
  return (typeof hash === 'string') && VALID_REFERRING_HASH_RE.test(hash)
}
module.exports._isValidReferringHash = _isValidReferringHash
