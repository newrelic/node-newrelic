'use strict'

var hashes = require('../util/hashes')
var logger = require('../logger').child({component: 'transaction'})
var Metrics = require('../metrics')
var NAMES = require('../metrics/names')
var NameState = require('./name-state')
var props = require('../util/properties')
var Timer = require('../timer')
var Trace = require('./trace')
var url = require('url')
var urltils = require('../util/urltils')


/*
 *
 * CONSTANTS
 *
 */
const DESTS = require('../config/attribute-filter').DESTINATIONS
const FROM_MILLIS = 1e-3
const TYPES = {
  WEB: 'web',
  BG: 'bg',
  MESSAGE: 'message'
}
const TYPES_SET = _makeValueSet(TYPES)
const TYPE_METRICS = {
  web: NAMES.WEB.RESPONSE_TIME,
  bg: NAMES.OTHER_TRANSACTION.RESPONSE_TIME,
  message: NAMES.OTHER_TRANSACTION.MESSAGE
}
const TRANSPORT_TYPES = {
  AMQP: 'AMQP',
  HTTP: 'HTTP',
  HTTPS: 'HTTPS',
  IRONMQ: 'IronMQ',
  JMS: 'JMS',
  KAFKA: 'Kafka',
  OTHER: 'Other',
  QUEUE: 'Queue',
  UNKNOWN: 'Unknown'
}
const TRANSPORT_TYPES_SET = _makeValueSet(TRANSPORT_TYPES)
const REQUIRED_DT_KEYS = ['ty', 'ac', 'ap', 'tr', 'ti']
const DTPayload = require('./dt-payload')
const DTPayloadStub = DTPayload.Stub


/**
 * Bundle together the metrics and the trace segment for a single agent
 * transaction.
 *
 * @param {Object} agent The agent.
 */
function Transaction(agent) {
  if (!agent) throw new Error('every transaction must be bound to the agent')

  this.traceFlag = false
  if (agent.config.logging.diagnostics) {
    this.traceStacks = []
  } else {
    this.traceStacks = null
  }

  this.agent = agent
  this.metrics = new Metrics(
    agent.config.apdex_t,
    agent.mapper,
    agent.metricNameNormalizer
  )

  ++agent.activeTransactions
  ++agent.transactionCreatedInHarvest

  this.numSegments = 0
  this.id = hashes.makeId()

  this.trace = new Trace(this)
  this.exceptions = []
  this.userErrors = []
  this.timer = new Timer()
  this.timer.begin()

  this._recorders = []
  this._intrinsicAttributes = Object.create(null)
  this._partialName = null

  // If handledExternally is set to true the transaction will not ended
  // automatically, instead it should be ended by user code.
  this.handledExternally = false

  // hidden class optimization
  this.catResponseTime = 0
  this.error = null
  this.forceIgnore = null
  this.forceName = null
  this.ignore = false
  this.incomingCatId = null
  this.name = null
  this.nameState = new NameState(null, null, null, null)
  this.pathHashes = []
  this.queueTime = 0
  this.referringPathHash = null
  this.referringTransactionGuid = null
  this.invalidIncomingExternalTransaction = false
  this.statusCode = null
  this.syntheticsHeader = null
  this.syntheticsData = null
  this.url = null
  this.parsedUrl = null
  this.verb = null
  this.baseSegment = null
  this.type = TYPES.WEB
  // DT fields
  this.parentId = null
  this.parentType = null
  this.parentApp = null
  this.parentAcct = null
  this.parentTransportType = null
  this.parentTransportDuration = null
  this.traceId = null
  this.parentSpanId = null
  this.isDistributedTrace = null
  this.acceptedDistributedTrace = null

  // Lazy evaluate the priority and sampling in case we end up accepting a payload.
  this.priority = null
  this.sampled = null

  agent.emit('transactionStarted', this)
  this.probe('Transaction created', {id: this.id})
}

Transaction.TYPES = TYPES
Transaction.TYPES_SET = TYPES_SET
Transaction.TRANSPORT_TYPES = TRANSPORT_TYPES
Transaction.TRANSPORT_TYPES_SET = TRANSPORT_TYPES_SET

Transaction.prototype.probe = function probe(action, extra) {
  if (this.traceStacks) {
    this.traceStacks.push({
      stack: (new Error(action)).stack.split('\n'),
      extra: extra
    })
  }
}

/**
 * Add a clear API method for determining whether a transaction is web or
 * background.
 *
 * @returns {boolean} Whether this transaction has a URL.
 */
Transaction.prototype.isWeb = function isWeb() {
  return this.type === TYPES.WEB
}

/**
 * @return {bool} Is this transaction still alive?
 */
Transaction.prototype.isActive = function isActive() {
  return this.timer.isActive()
}

/**
 * Close out the current transaction and its associated trace. Remove any
 * instances of this transaction annotated onto the call stack.
 */
Transaction.prototype.end = function end() {
  if (!this.timer.isActive()) return
  if (this.traceFlag) {
    logger.warn(
      {segment: {name: this.name, stacks: this.traceStacks}},
      'Flagged transaction ended.'
    )
  }

  if (!this.name) {
    this.finalizeName(null) // Use existing partial name.
  }
  if (this.baseSegment) {
    this.baseSegment.touch()
  }

  this.agent.recordSupportability('Nodejs/Transactions/Segments', this.numSegments)
  this._calculatePriority()

  this.trace.end()

  this.timer.end()
  // recorders must be run before the trace is collected
  if (!this.ignore) {
    this.record()

    // This method currently must be called after all recorders have been fired due
    // to some of the recorders (namely the db recorders) adding parameters to the
    // segments.
    this.trace.generateSpanEvents()
  }

  this.agent.emit('transactionFinished', this)
  return this
}

/**
 * For web transactions, this represents the time from when the request was received
 * to when response was sent.  For background transactions, it is equal to duration
 * of the transaction trace (until last segment ended).
 */
Transaction.prototype.getResponseTimeInMillis = function getResponseTimeInMillis() {
  if (this.isWeb()) {
    return this.timer.getDurationInMillis()
  }
  return this.trace.getDurationInMillis()
}

/**
 * Executes the user and server provided naming rules to clean up the given url.
 *
 * @private
 *
 * @param {string} requestUrl - The URL to normalize.
 *
 * @return {object} The normalization results after running user and server rules.
 */
Transaction.prototype._runUserNamingRules = function _runUserNamingRules(requestUrl) {
  // 1. user normalization rules (set in configuration)
  var normalized = this.agent.userNormalizer.normalize(requestUrl)
  if (normalized.matched) {
    // After applying user naming rule, apply server-side sent rules to
    // further squash possible MGIs
    var serverNormalized = this.agent.urlNormalizer.normalize(normalized.value)
    if (serverNormalized.ignore) {
      normalized.ignore = true
    }
    if (serverNormalized.matched) {
      // NAMES.NORMALIZED is prepended by the sever rule normalizer
      normalized.value = serverNormalized.value
    } else {
      normalized.value = NAMES.NORMALIZED + normalized.value
    }
  }
  return normalized
}

/**
 * Executes the user naming rules and applies the results to the transaction.
 *
 * @param {string} requestUrl - The URL to normalize and apply to this transaction.
 */
Transaction.prototype.applyUserNamingRules = function applyUserNamingRules(requestUrl) {
  var normalized = this._runUserNamingRules(requestUrl)
  if (normalized.ignore) {
    this.ignore = normalized.ignore
  }
  if (normalized.matched) {
    this._partialName = normalized.value
  }
}

/**
 * Set's the transaction partial name.
 *
 * The partial name is everything after the `WebTransaction/` part.
 *
 * @param {string} name - The new transaction partial name to use.
 */
Transaction.prototype.setPartialName = function setPartialName(name) {
  this._partialName = name
}

/**
 * Derive the transaction partial name from the given url and status code.
 *
 * @private
 *
 * @param {string} requestUrl - The URL to derive the name from.
 * @param {number} status     - The status code of the response.
 *
 * @return {object} An object with the derived partial name in `value` and a
 *  boolean flag in `ignore`.
 */
Transaction.prototype._partialNameFromUri = _partialNameFromUri
function _partialNameFromUri(requestUrl, status) {
  var scrubbedUrl = urltils.scrub(requestUrl)

  // 0. If there is a name in the name-state stack, use it.
  var partialName = this._partialName
  var ignore = false
  if (!this.nameState.isEmpty()) {
    partialName = this.nameState.getFullName()
  }

  // 1. name set by the api
  if (this.forceName !== null) {
    partialName = this.forceName
  }

  // 2. user normalization rules (set in configuration) can override transaction
  // naming from API
  var userNormalized = this._runUserNamingRules(scrubbedUrl)
  ignore = ignore || userNormalized.ignore
  if (userNormalized.matched) {
    partialName = userNormalized.value
  }

  // 3. URL normalization rules (sent by server).
  // Nothing has already set a name for this transaction, so normalize and
  // potentially apply the URL backstop now. Only do so if no user rules matched.
  if (!partialName) {
    // avoid polluting root path when 404
    if (status === 404) {
      partialName = this.nameState.getNameNotFound()
    } else {
      var normalized = this.agent.urlNormalizer.normalize(scrubbedUrl)
      ignore = ignore || normalized.ignore
      partialName = normalized.value
    }
  }

  return {
    ignore: ignore,
    value: partialName
  }
}

/**
 * Set the forceIgnore value on the transaction. This will cause the
 * transaction to clean up after itself without collecting any data.
 *
 * @param {Boolean} ignore The value to assign to  transaction.ignore
 */
Transaction.prototype.setForceIgnore = function setForceIgnore(ignore) {
  if (ignore != null) {
    this.forceIgnore = ignore
  } else {
    logger.debug("Transaction#setForceIgnore called with null value")
  }
}

/**
 *
 * Gets the current ignore state for the transaction.
 *
 */

Transaction.prototype.isIgnored = function getIgnore() {
  return this.ignore || this.forceIgnore
}

/**
 * Derives the transaction's name from the given URL and status code.
 *
 * The transaction's name will be set after this as well as its ignored status
 * based on the derived name.
 *
 * @param {string} requestURL - The URL to derive the request's name and status from.
 * @param {number} statusCode - The response status code.
 */
Transaction.prototype.finalizeNameFromUri = finalizeNameFromUri
function finalizeNameFromUri(requestURL, statusCode) {
  logger.trace({requestURL: requestURL, statusCode: statusCode, transactionId: this.id,
    transactionName: this.name}, 'Setting transaction name')

  this.url = urltils.scrub(requestURL)
  this.statusCode = statusCode

  // Derive the name from the request URL.
  var partialName = this._partialNameFromUri(requestURL, statusCode)
  this._partialName = partialName.value
  if (partialName.ignore) {
    this.ignore = true
  }

  // If a namestate stack exists, copy route parameters over to the trace.
  if (!this.nameState.isEmpty() && this.baseSegment) {
    this.nameState.forEachParams(function forEachRouteParams(params) {
      for (var key in params) {
        if (props.hasOwn(params, key)) {
          this.trace.attributes.addAttribute(
            DESTS.NONE,
            'request.parameters.' + key,
            params[key]
          )
        }
      }
    }, this)
  }

  // Apply transaction name normalization rules (sent by server) to full name.
  var fullName = TYPE_METRICS[this.type] + '/' + this._partialName
  var normalized = this.agent.transactionNameNormalizer.normalize(fullName)
  if (normalized.ignore) {
    this.ignore = true
  }
  this.name = normalized.value

  // 5. transaction segment term normalizer
  this.name = this.agent.txSegmentNormalizer.normalize(this.name).value

  // Allow the API to explicitly set the ignored status.
  if (this.forceIgnore !== null) {
    this.ignore = this.forceIgnore
  }

  this.baseSegment && this._markAsWeb(requestURL)
  logger.trace({
    transactionId: this.id,
    transactionName: this.name,
    ignore: this.ignore
  }, 'Finished setting transaction name from Uri')
}

/**
 * Copies final base segment parameters to trace attributes before reapplying
 * them to the segment.
 *
 * @param {string} rawURL The URL, as it came in, for parameter extraction.
 */
Transaction.prototype._markAsWeb = function _markAsWeb(rawURL) {
  // Because we are assured we have the URL here, lets grab query params.
  var params = urltils.parseParameters(rawURL)
  for (var key in params) {
    if (props.hasOwn(params, key)) {
      this.trace.attributes.addAttribute(
        DESTS.NONE,
        'request.parameters.' + key,
        params[key]
      )
    }
  }
  this.baseSegment.markAsWeb()
}

/**
 * Sets the transaction's name and determines if it will be ignored.
 *
 * @param {string} [name]
 *  Optional. The partial name to use for the finalized transaction. If ommitted
 *  the current partial name is used.
 */
Transaction.prototype.finalizeName = function finalizeName(name) {
  // If no name is given, and this is a web transaction with a url, then
  // finalize the name using the stored url.
  if (name == null && this.type === 'web' && this.url) {
    return this.finalizeNameFromUri(this.url, this.statusCode)
  }

  this._partialName = this.forceName || name || this._partialName
  if (!this._partialName) {
    logger.debug('No name for transaction %s, not finalizing.', this.id)
    return
  }

  var fullName = TYPE_METRICS[this.type] + '/' + this._partialName

  // Transaction normalizers run on the full metric name, not the user facing
  // transaction name.
  var normalized = this.agent.transactionNameNormalizer.normalize(fullName)
  if (normalized.ignore) {
    this.ignore = true
  }
  this.name = normalized.value

  if (this.forceIgnore !== null) {
    this.ignore = this.forceIgnore
  }

  this.baseSegment && this.baseSegment.setNameFromTransaction()

  logger.trace({
    transactionId: this.id,
    transactionName: this.name,
    ignore: this.ignore
  }, 'Finished setting transaction name from string')
}

/**
 * Gets the transaction name safely.
 *
 * Gathering the transaction name for WebTransactions is risky complicated
 * business. OtherTransactions (aka background) are much simpler as they are
 * always fully specified by the user at creation time.
 *
 * This has the potential of causing the normalizers run extra times, which can
 * cause extra performance overhead. Once this is refactored we can make the
 * caching better and eliminate this extra overhead. Be mindful of if/when this
 * is called.
 */
Transaction.prototype.getName = function getName() {
  if (this.isWeb() && this.url) {
    return this._partialNameFromUri(this.url, this.statusCode).value
  }
  return this._partialName
}

Transaction.prototype.getFullName = function getFullName() {
  var name = null
  if (this.forceName) {
    name = this.forceName
  } else if (this.name) {
    return this.name
  } else {
    name = this.getName()
  }

  if (!name) {
    return null
  }
  var fullName = TYPE_METRICS[this.type] + '/' + name
  return this.agent.transactionNameNormalizer.normalize(fullName).value
}

/**
 * Returns the full URL of the transaction with query, search, or hash portions
 * removed. This is only applicable for web transactions.
 *
 * Caches to ._scrubbedUrl, pulls in from .parsedUrl if it is available,
 * otherwise it will parse .url, store it on .parsedUrl, then scrub the URL and
 * store it in the cache.
 *
 * Returns a string or undefined.
 */
Transaction.prototype.getScrubbedUrl = function getScrubbedUrl() {
  if (!this.isWeb()) return
  if (this._scrubbedUrl) return this._scrubbedUrl

  // If we don't have a parsedUrl, lets populate it from .url
  if (!this.parsedUrl) {
    // At time of writing .url should always be set by the time we get here
    // because that is what .isWeb() checks against. In the future it may be
    // instead checking a enum or other property so guard ourselves just in
    // case.
    if (!this.url) return
    this.parsedUrl = url.parse(this.url)
  }

  var scrubbedParsedUrl = Object.assign(Object.create(null), this.parsedUrl)
  scrubbedParsedUrl.search = null
  scrubbedParsedUrl.query = null
  scrubbedParsedUrl.href = null
  scrubbedParsedUrl.path = null
  scrubbedParsedUrl.hash = null

  this._scrubbedUrl = url.format(scrubbedParsedUrl)

  return this._scrubbedUrl
}

/**
 * The instrumentation associates metrics with the different kinds of trace
 * segments. The metrics recorders are dependent on the transaction name to
 * collect their scoped metrics, and so must wait for the transaction's
 * name to be finalized before the recording process. Segments are only
 * responsible for their own life cycle, so responsibility for understanding
 * when the transaction name has been finalized is handed off to the trace,
 * which for now defers running these recorders until the trace is ended.
 *
 * @param {Function} recorder The callback which records metrics. Takes a
 *                            single parameter, which is the transaction's
 *                            name.
 */
Transaction.prototype.addRecorder = function addRecorder(recorder) {
  this._recorders.push(recorder)
}

/**
 * Run the metrics recorders for this trace. If the transaction's name /
 * scope hasn't been set yet, the recorder will be passed an undefined name,
 * and should be written to handle this.
 */
Transaction.prototype.record = function record() {
  var name = this.name
  for (var i = 0, l = this._recorders.length; i < l; ++i) {
    this._recorders[i](name)
  }
}

/**
 * Measure the duration of an operation named by a metric, optionally
 * belonging to a scope.
 *
 * @param {string} name The name of the metric to gather.
 * @param {string} scope (optional) Scope to which the metric is bound.
 * @param {number} duration The time taken by the operation, in milliseconds.
 * @param {number} exclusive The time exclusively taken by an operation, and
 *                           not its children.
 */
Transaction.prototype.measure = function measure(name, scope, duration, exclusive) {
  this.metrics.measureMilliseconds(name, scope, duration, exclusive)
}

/**
 * Based on the status code and the duration of a web transaction, either
 * mark the transaction as frustrating, or record its time for apdex purposes.
 *
 * @param {string} name     Metric name.
 * @param {number} duration Duration of the transaction, in milliseconds.
 * @param {number} keyApdex A key transaction apdexT, in milliseconds
 *                          (optional).
 */
Transaction.prototype._setApdex = function _setApdex(name, duration, keyApdexInMillis) {
  var apdexStats = this.metrics.getOrCreateApdexMetric(name, null, keyApdexInMillis)
  if (urltils.isError(this.agent.config, this.statusCode)) {
    apdexStats.incrementFrustrating()
  } else {
    apdexStats.recordValueInMillis(duration, keyApdexInMillis)
  }
}

/**
 * Store first 10 unique path hashes calculated for a transaction.
 *
 * @param {string} pathHash Path hash
 */
Transaction.prototype.pushPathHash = function pushPathHash(pathHash) {
  if (this.pathHashes.length >= 10 || this.pathHashes.indexOf(pathHash) !== -1) return
  this.pathHashes.unshift(pathHash)
}

/**
 * Return whether transaction spawned any outbound requests.
 */
Transaction.prototype.includesOutboundRequests = function includesOutboundRequests() {
  return this.pathHashes.length > 0
}

/**
 * Get unique previous path hashes for a transaction. Does not include
 * current path hash.
 */
Transaction.prototype.alternatePathHashes = function alternatePathHashes() {
  var curHash = hashes.calculatePathHash(
    this.agent.config.applications()[0],
    this.getFullName(),
    this.referringPathHash
  )
  var altHashes = this.pathHashes.slice()
  var curIndex = altHashes.indexOf(curHash)

  if (curIndex !== -1) altHashes.splice(curIndex, 1)

  return altHashes.length === 0 ? null : altHashes.sort().join(',')
}

/**
 * Associate an exception with the transaction.  When the transaction ends,
 * the exception will be collected along with the transaction details.
 *
 * @param {Error}   exception         The exception to be collected.
 * @param {object}  customAttributes  Any custom attributes associated with
 *                                    the request (optional).
 * @param {number}  timestamp         The timestamp for when the exception occurred.
 */
Transaction.prototype.addException = _addException

function _addException(exception, customAttributes, timestamp) {
  this.exceptions.push([exception, customAttributes, timestamp])
}

/**
 * Associate a user error (reported using the noticeError() API) with the transaction.
 * When the transaction ends, the exception will be collected along with the transaction
 * details.
 *
 * @param {Error}   exception         The exception to be collected.
 * @param {object}  customAttributes  Any custom attributes associated with
 *                                    the request (optional).
 * @param {number}  timestamp         The timestamp for when the exception occurred.
 */
Transaction.prototype.addUserError = _addUserError

function _addUserError(exception, customAttributes, timestamp) {
  this.userErrors.push([exception, customAttributes, timestamp])
}

/**
 * Returns true if an error happened during the transaction or if the transaction itself
 * is considered to be an error.
 */
Transaction.prototype.hasErrors = function _hasErrors() {
  var isErroredTransaction = urltils.isError(this.agent.config, this.statusCode)
  var transactionHasExceptions = this.exceptions.length > 0
  var transactionHasuserErrors = this.userErrors.length > 0
  return (transactionHasExceptions || transactionHasuserErrors || isErroredTransaction)
}

/**
 * Returns agent intrinsic attribute for this transaction.
 */
Transaction.prototype.getIntrinsicAttributes = function getIntrinsicAttributes() {
  if (!this._intrinsicAttributes.totalTime) {
    var config = this.agent.config
    this._intrinsicAttributes.totalTime =
      this.trace.getTotalTimeDurationInMillis() * FROM_MILLIS

    if (config.distributed_tracing.enabled) {
      this.addDistributedTraceIntrinsics(this._intrinsicAttributes)
    } else if (config.cross_application_tracer.enabled) {
      this._intrinsicAttributes.path_hash = hashes.calculatePathHash(
        config.applications()[0],
        this.name || this._partialName,
        this.referringPathHash
      )
      this._intrinsicAttributes.trip_id = this.tripId || this.id
      if (this.referringTransactionGuid) {
        this._intrinsicAttributes.referring_transaction_guid =
          this.referringTransactionGuid
      }
      if (this.incomingCatId) {
        this._intrinsicAttributes.client_cross_process_id = this.incomingCatId
      }
    }

    if (this.syntheticsData) {
      this._intrinsicAttributes.synthetics_resource_id = this.syntheticsData.resourceId
      this._intrinsicAttributes.synthetics_job_id = this.syntheticsData.jobId
      this._intrinsicAttributes.synthetics_monitor_id = this.syntheticsData.monitorId
    }
  }
  return Object.assign(Object.create(null), this._intrinsicAttributes)
}

/**
 * Parses incoming distributed trace header payload.
 *
 * @param {object} payload                - The distributed trace payload to accept.
 * @param {string} [transport='Unknown']  - The transport type that delivered the payload.
 */
Transaction.prototype.acceptDistributedTracePayload = acceptDistributedTracePayload
function acceptDistributedTracePayload(payload, transport) {
  if (!payload) {
    this.agent.recordSupportability('DistributedTrace/AcceptPayload/Ignored/Null')
    return
  }

  if (this.isDistributedTrace) {
    logger.warn(
      'Already accepted distributed trace payload for transaction %s, ignoring call',
      this.id
    )
    if (this.parentId) {
      this.agent.recordSupportability('DistributedTrace/AcceptPayload/Ignored/Multiple')
    } else {
      this.agent.recordSupportability(
        'DistributedTrace/AcceptPayload/Ignored/CreateBeforeAccept'
      )
    }
    return
  }

  const config = this.agent.config
  const distTraceEnabled = config.distributed_tracing.enabled
  const trustedAccount = config.trusted_account_key || config.account_id

  if (!distTraceEnabled || !trustedAccount) {
    logger.debug(
      'Invalid configuration for distributed trace payload, not accepting ' +
      '(distributed_tracing.enabled: %s, trustKey: %s',
      distTraceEnabled,
      trustedAccount
    )

    this.agent.recordSupportability('DistributedTrace/AcceptPayload/Exception')
    return
  }

  const parsed = this._getParsedPayload(payload)

  if (!parsed) {
    return
  }

  if (!parsed.v || !parsed.d) {
    if (!parsed.v) {
      logger.warn(
        'Received a distributed trace payload with no version field',
        this.id
      )
    }
    if (!parsed.d) {
      logger.warn(
        'Received a distributed trace payload with no data field',
        this.id
      )
    }
    this.agent.recordSupportability('DistributedTrace/AcceptPayload/ParseException')
    return
  }

  const majorVersion = parsed.v && typeof parsed.v[0] === 'number' && parsed.v[0]
  if (majorVersion == null) {
    logger.warn('Invalid distributed trace payload, not accepting')
    this.agent.recordSupportability('DistributedTrace/AcceptPayload/Exception')
  }
  if (majorVersion > 0) { // TODO: Add DistributedTracePayload class?
    this.agent.recordSupportability('DistributedTrace/AcceptPayload/Ignored/MajorVersion')
    return
  }

  const data = parsed.d

  if (!data) {
    logger.warn('No distributed trace data received, not accepting payload')
    this.agent.recordSupportability('DistributedTrace/AcceptPayload/Exception')
    return
  }

  const requiredKeysExist = REQUIRED_DT_KEYS.every(function checkExists(key) {
    return data[key] != null
  })
  // Either parentSpanId or parentId are required.
  if (!requiredKeysExist || data.tx == null && data.id == null) {
    this.agent.recordSupportability('DistributedTrace/AcceptPayload/ParseException')
    return
  }

  const trustedAccountKey = data.tk || data.ac
  if (trustedAccountKey !== trustedAccount) {
    this.agent.recordSupportability(
      `DistributedTrace/AcceptPayload/Ignored/UntrustedAccount`
    )
    return
  }

  transport = TRANSPORT_TYPES_SET[transport] ? transport : 'Unknown'

  this.parentType = data.ty
  this.parentApp = data.ap
  this.parentAcct = data.ac
  this.parentTransportType = transport
  this.parentTransportDuration = Math.max(0, (Date.now() - data.ti) / 1000)
  this.traceId = data.tr

  if (data.pr) {
    this.priority = data.pr
    this.sampled = data.sa != null ? data.sa : this.sampled
  }

  if (data.tx) {
    this.parentId = data.tx
  }

  if (data.id) {
    this.parentSpanId = data.id
  }

  this.isDistributedTrace = true
  // Track if the distributed trace was created through accepting, since
  // there is potentially no data difference between creation from
  // Mobile or Browser trace payloads and creation.
  this.acceptedDistributedTrace = true

  this.agent.recordSupportability('DistributedTrace/AcceptPayload/Success')
}

/**
 * Returns parsed payload object after attempting to decode it from base64,
 * and parsing the JSON string.
 */
Transaction.prototype._getParsedPayload = function _getParsedPayload(payload) {
  let parsed = payload

  if (typeof payload === 'string') {
    if (payload.charAt(0) !== '{' && payload.charAt(0) !== '[') {
      try {
        payload = Buffer.from(payload, 'base64').toString('utf-8')
      } catch (err) {
        logger.warn(
          err,
          'Got unparseable distributed trace payload in transaction %s',
          this.id
        )
        this.agent.recordSupportability('DistributedTrace/AcceptPayload/ParseException')
        return null
      }
    }
    try {
      parsed = JSON.parse(payload)
    } catch (err) {
      logger.warn(
        err,
        'Failed to parse distributed trace payload in transaction %s',
        this.id
      )
      this.agent.recordSupportability('DistributedTrace/AcceptPayload/ParseException')
      return null
    }
  }

  return parsed
}

/**
 * Creates a distributed trace payload.
 */
Transaction.prototype.createDistributedTracePayload = createDistributedTracePayload

function createDistributedTracePayload() {
  const config = this.agent.config
  const accountId = config.account_id
  const appId = config.primary_application_id
  const distTraceEnabled = config.distributed_tracing.enabled

  if (!accountId || !appId || !distTraceEnabled) {
    logger.debug(
      'Invalid configuration for distributed trace payload ' +
      '(distributed_tracing.enabled: %s, account_id: %s, application_id: %s) ' +
      'in transaction %s',
      distTraceEnabled,
      accountId,
      appId,
      this.id
    )

    return new DTPayloadStub()
  }

  this._calculatePriority()

  const currSegment = this.agent.tracer.getSegment()
  const data = {
    ty: 'App',
    ac: accountId,
    ap: appId,
    tx: this.id,
    tr: this.traceId || this.id,
    pr: this.priority,
    sa: this.sampled,
    ti: Date.now()
  }

  if (config.span_events.enabled && this.sampled && currSegment) {
    data.id = currSegment.id
  }

  if (config.trusted_account_key && config.trusted_account_key !== accountId) {
    data.tk = config.trusted_account_key
  }

  this.isDistributedTrace = true
  this.agent.recordSupportability('DistributedTrace/CreatePayload/Success')

  return new DTPayload(data)
}

/**
 * Adds distributed trace attributes to instrinsics object.
 */
Transaction.prototype.addDistributedTraceIntrinsics = addDistributedTraceIntrinsics
function addDistributedTraceIntrinsics(attrs) {
  this._calculatePriority()

  // *always* add these if DT flag is enabled.
  attrs.traceId = this.traceId || this.id
  attrs.guid = this.id
  attrs.priority = this.priority

  attrs.sampled = !!this.sampled

  // add the rest only if payload was received
  if (this.parentType) {
    attrs['parent.type'] = this.parentType
  }

  if (this.parentApp) {
    attrs['parent.app'] = this.parentApp
  }

  if (this.parentAcct) {
    attrs['parent.account'] = this.parentAcct
  }

  if (this.parentTransportType) {
    attrs['parent.transportType'] = this.parentTransportType
  }

  if (this.parentTransportDuration != null) {
    attrs['parent.transportDuration'] = this.parentTransportDuration
  }
}

/**
 * Generates a priority for the transaction if it does not have one already.
 */
Transaction.prototype._calculatePriority = function _calculatePriority() {
  if (this.priority === null) {
    this.priority = Math.random()
    // We want to separate the priority roll from the decision roll to
    // avoid biasing the priority range
    this.sampled = this.agent.transactionSampler.shouldSample(Math.random())
    if (this.sampled) {
      this.priority += 1
    }

    // Truncate the priority after potentially modifying it to avoid floating
    // point errors.
    this.priority = (this.priority * 1e6 | 0) / 1e6
  }
}

function _makeValueSet(obj) {
  return Object.keys(obj).map((t) => obj[t]).reduce(function reduceToMap(o, t) {
    o[t] = true
    return o
  }, Object.create(null))
}

Transaction.prototype.addRequestParameters = addRequestParameters

/**
 * Adds request/query parameters to create attributes in the form
 * 'request.parameters.{key}'. These attributes will only be created
 * when 'request.parameters.*' is included in the attribute config.
 * @param {Object.<string, string>} requestParameters
 */
function addRequestParameters(requestParameters) {
  for (var key in requestParameters) {
    if (props.hasOwn(requestParameters, key)) {
      this.trace.attributes.addAttribute(
        DESTS.NONE,
        'request.parameters.' + key,
        requestParameters[key]
      )
    }
  }
}

module.exports = Transaction
