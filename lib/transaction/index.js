/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const errorHelper = require('../errors/helper')
const hashes = require('../util/hashes')
const logger = require('../logger').child({ component: 'transaction' })
const Metrics = require('../metrics')
const NAMES = require('../metrics/names')
const NameState = require('./name-state')
const Timer = require('../timer')
const Trace = require('./trace')
const synthetics = require('../synthetics')
const urltils = require('../util/urltils')
const cat = require('../util/cat')
const TraceContext = require('./tracecontext').TraceContext
const Logs = require('./logs')
const headerAttributes = require('../header-attributes')
const headerProcessing = require('../header-processing')
const DT_ACCEPT_PAYLOAD_EXCEPTION_METRIC = 'DistributedTrace/AcceptPayload/Exception'
const DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC = 'DistributedTrace/AcceptPayload/ParseException'
const QUERY_PARAMS_PATH = 'request.parameters.'
const ROUTE_PARAMS_PREFIX = 'request.parameters.route.'

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
const PartialTrace = require('./trace/partial-trace')
const DTPayloadStub = DTPayload.Stub

const TRACE_CONTEXT_PARENT_HEADER = 'traceparent'
const TRACE_CONTEXT_STATE_HEADER = 'tracestate'
const NEWRELIC_TRACE_HEADER = 'newrelic'

const MULTIPLE_INSERT_MESSAGE =
  'insertDistributedTraceHeaders called on headers object that already contains ' +
  "distributed trace data. These may be overwritten. traceparent? '%s', newrelic? '%s'."

const PARTIAL_TYPES = {
  REDUCED: 'reduced',
  ESSENTIAL: 'essential',
  COMPACT: 'compact'
}

/**
 * Bundle together the metrics and the trace segment for a single agent
 * transaction.
 *
 * @param {object} agent The agent.
 * @param {string} traceId if present, it will use this to assign traceId of transaction. only used in otel bridge mode to ensure trace id is same as otel spans
 * @fires Agent#transactionStarted
 */
function Transaction(agent, traceId) {
  if (!agent) {
    throw new Error('every transaction must be bound to the agent')
  }

  this.agent = agent
  this.metrics = new Metrics(agent.config.apdex_t, agent.mapper, agent.metricNameNormalizer)

  ++agent.activeTransactions

  this.numSegments = 0
  this.id = hashes.makeId(16)

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
  this.syntheticsInfoHeader = null
  this.syntheticsData = null
  this.syntheticsInfoData = null
  this.url = null
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
  this._traceId = traceId || null
  Object.defineProperty(this, 'traceId', {
    get() {
      if (this._traceId === null) {
        this._traceId = hashes.makeId(32)
      }
      return this._traceId
    },
    set(traceId) {
      this._traceId = traceId
    }
  })
  this.parentSpanId = null
  this.isDistributedTrace = null
  this.acceptedDistributedTrace = null

  // Lazy evaluate the priority and sampling in case we end up accepting a payload.
  this.priority = null
  this.sampled = null
  this.traceContext = new TraceContext(this)
  this.logs = new Logs(agent)
  this.ignoreApdex = false
  // flag used to create partial trace when transaction ends
  this.partialType = null
  // partial trace is created when transaction ends and if transaction is partialType
  this.partialTrace = null

  agent.emit('transactionStarted', this)
}

Transaction.DESTINATIONS = DESTS
Transaction.TYPES = TYPES
Transaction.TYPES_SET = TYPES_SET
Transaction.TRANSPORT_TYPES = TRANSPORT_TYPES
Transaction.TRANSPORT_TYPES_SET = TRANSPORT_TYPES_SET
Transaction.TRACE_CONTEXT_PARENT_HEADER = TRACE_CONTEXT_PARENT_HEADER
Transaction.PARTIAL_TYPES = PARTIAL_TYPES

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
 * @returns {boolean} Is this transaction still alive?
 */
Transaction.prototype.isActive = function isActive() {
  return this.timer.isActive()
}

/**
 * Close out the current transaction and its associated trace. Remove any
 * instances of this transaction annotated onto the call stack.
 *
 * @returns {Transaction|undefined} this transaction, or undefined
 *
 * @fires Agent#transactionFinished
 */
Transaction.prototype.end = function end() {
  if (!this.timer.isActive()) {
    return
  }

  if (!this.name) {
    this.finalizeName(null) // Use existing partial name.
  }
  if (this.baseSegment) {
    this.baseSegment.touch()
  }

  this.agent.recordSupportability('Nodejs/Transactions/Segments', this.numSegments)
  this.agent.samplers.applySamplingDecision({ transaction: this })
  this.trace.end()

  this.timer.end()
  // recorders must be run before the trace is collected
  if (!this.ignore) {
    this.record()

    // This method currently must be called after all recorders have been fired due
    // to some of the recorders (namely the db recorders) adding parameters to the
    // segments.
    if (this.partialType && this.agent.spanEventAggregator.toString() !== 'StreamingSpanEventAggregator') {
      this.createPartialTrace()
      this.partialTrace.generateSpanEvents()
    } else {
      this.trace.generateSpanEvents()
    }
    this.logs.flush(this.priority)
  }

  this.agent.emit('transactionFinished', this)

  // Do after emit so all post-processing can complete
  this._cleanUnneededReferences()

  return this
}

/**
 * Method to lazily create PartialTrace
 * This is only called if `transaction.partialType` is not null
 */
Transaction.prototype.createPartialTrace = function createPartialTrace() {
  this.partialTrace = new PartialTrace(this)
}

/**
 * Cleans up references that will not be used later for processing such as
 * transaction traces.
 *
 * Errors won't be needed for later processing but can contain extra details we
 * don't want to hold in memory. Particularly, axios errors can result in indirect
 * references to promises which will prevent them from being destroyed and result
 * in a memory leak. This is due to the TraceSegment not getting removed from the
 * async-hooks segmentMap because 'destroy' never fires.
 */
Transaction.prototype._cleanUnneededReferences = function _cleanUnneededReferences() {
  this.userErrors = null
  this.exceptions = null
}

/**
 * For web transactions, this represents the time from when the request was received
 * to when response was sent.  For background transactions, it is equal to duration
 * of the transaction trace (until last segment ended).
 *
 * @returns {number} timer or trace duration in milliseconds
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
 * @param {string} requestUrl - The URL to normalize.
 * @returns {object} The normalization results after running user and server rules.
 */
Transaction.prototype._runUserNamingRules = function _runUserNamingRules(requestUrl) {
  // 1. user normalization rules (set in configuration)
  const normalized = this.agent.userNormalizer.normalize(requestUrl)
  if (normalized.matched) {
    // After applying user naming rule, apply server-side sent rules to
    // further squash possible MGIs
    const serverNormalized = this.agent.urlNormalizer.normalize(normalized.value)
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
  const normalized = this._runUserNamingRules(requestUrl)
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
 * @param {string} requestUrl - The URL to derive the name from.
 * @param {number} status     - The status code of the response.
 * @returns {object} An object with the derived partial name in `value` and a
 *  boolean flag in `ignore`.
 */
Transaction.prototype._partialNameFromUri = _partialNameFromUri
function _partialNameFromUri() {
  const scrubbedUrl = this.url
  const status = this.statusCode

  // 0. If there is a name in the name-state stack, use it.
  let partialName = this._partialName
  let ignore = false
  if (!this.nameState.isEmpty()) {
    partialName = this.nameState.getFullName()
  }

  // 1. name set by the api
  if (this.forceName !== null) {
    partialName = this.forceName
  }

  // 2. user normalization rules (set in configuration) can override transaction
  // naming from API
  const userNormalized = this._runUserNamingRules(scrubbedUrl)
  ignore = ignore || userNormalized.ignore
  if (userNormalized.matched) {
    partialName = userNormalized.value
  }

  // 3. URL normalization rules (sent by server).
  // Nothing has already set a name for this transaction, so normalize and
  // potentially apply the URL backstop now. Only do so if no user rules matched.
  if (!partialName) {
    // avoid polluting root path when 404
    const statusName = this.nameState.getStatusName(status)
    if (statusName) {
      partialName = statusName
    } else {
      const normalized = this.agent.urlNormalizer.normalize(scrubbedUrl)
      ignore = ignore || normalized.ignore
      partialName = normalized.value
    }
  }

  return {
    ignore,
    value: partialName
  }
}

/**
 * Set the forceIgnore value on the transaction. This will cause the
 * transaction to clean up after itself without collecting any data.
 *
 * @param {boolean} ignore The value to assign to  transaction.ignore
 */
Transaction.prototype.setForceIgnore = function setForceIgnore(ignore) {
  if (ignore != null) {
    this.forceIgnore = ignore
  } else {
    logger.debug('Transaction#setForceIgnore called with null value')
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
 * Finalize a web transaction. This includes naming the transaction, collecting
 * response headers, and ending the transaction and its base segment.
 *
 * @param {object} params The parameters for finalizing the transaction.
 * @param {number} params.statusCode The response status code.
 * @param {string} [params.statusMessage] The response status message.
 * @param {object} [params.headers] The response headers.
 * @param {boolean} params.end Whether to end the transaction and baseSegment.
 */
Transaction.prototype.finalizeWeb = function finalizeWeb({ statusCode, statusMessage, headers, end }) {
  // Naming must happen before the segment and transaction are ended
  // because metrics recording depends on naming's side effects.
  this.finalizeNameFromWeb(statusCode)
  if (statusCode != null) {
    const responseCode = String(statusCode)

    if (/^\d+$/.test(responseCode)) {
      this.trace.attributes.addAttribute(
        DESTS.TRANS_COMMON,
        'http.statusCode',
        responseCode
      )

      this.baseSegment.addSpanAttribute('http.statusCode', responseCode)
    }
  }

  if (statusMessage !== undefined) {
    this.trace.attributes.addAttribute(
      DESTS.TRANS_COMMON,
      'http.statusText',
      statusMessage
    )

    this.baseSegment.addSpanAttribute('http.statusText', statusMessage)
  }

  if (headers) {
    headerAttributes.collectResponseHeaders(headers, this)
  }

  if (end) {
    // And we are done! End the segment and transaction.
    this.baseSegment.end()
    this.end()
  }
}

/**
 * Derives the transaction's name from `transaction.url` and status code.
 *
 * The transaction's name will be set after this as well as its ignored status
 * based on the derived name.
 *
 * @param {number} statusCode - The response status code.
 */
Transaction.prototype.finalizeNameFromWeb = finalizeNameFromWeb

function finalizeNameFromWeb(statusCode) {
  if (logger.traceEnabled()) {
    logger.trace(
      {
        requestURL: this.url,
        statusCode,
        transactionId: this.id,
        transactionName: this.name
      },
      'Setting transaction name'
    )
  }

  this.statusCode = statusCode
  this.name = this.getFullName()

  // If a namestate stack exists, copy route parameters over to the trace.
  if (!this.nameState.isEmpty() && this.baseSegment && this.agent.config.high_security === false) {
    this.nameState.forEachParams(forEachRouteParams, this)
  }

  // Allow the API to explicitly set the ignored status.
  if (this.forceIgnore !== null) {
    this.ignore = this.forceIgnore
  }

  const obfuscatedUrl = urltils.obfuscatePath(this.agent.config, this.url)
  this.url = obfuscatedUrl
  // URL is sent as an agent attribute with transaction events
  this.trace.attributes.addAttribute(
    DESTS.TRANS_EVENT | DESTS.ERROR_EVENT,
    'request.uri',
    obfuscatedUrl
  )

  this?.baseSegment?.markAsWeb(this, obfuscatedUrl)

  this._copyNameToActiveSpan(this.name)

  if (logger.traceEnabled()) {
    logger.trace(
      {
        transactionId: this.id,
        transactionName: this.name,
        ignore: this.ignore
      },
      'Finished setting transaction name from Uri'
    )
  }
}

/**
 * Adds `request.parameters.route` to trace and segment for all the router params
 * for a framework
 *
 * @param {object} params route params from given webframework
 */
function forEachRouteParams(params) {
  for (const [key, value] of Object.entries(params)) {
    this.trace.attributes.addAttribute(DESTS.NONE, ROUTE_PARAMS_PREFIX + key, value)

    const segment = this.agent.tracer.getSegment()

    if (!segment) {
      logger.trace(
        'Active segment not available, not adding request.parameters.route attribute for %s',
        key
      )
    } else {
      segment.attributes.addAttribute(DESTS.NONE, ROUTE_PARAMS_PREFIX + key, value)
    }
  }
}

Transaction.prototype._copyNameToActiveSpan = function _copyNameToActiveSpan(name) {
  const spanContext = this.agent.tracer.getSpanContext()
  if (!spanContext) {
    logger.trace('Span context not available, not adding transaction.name attribute for %s', name)
    return
  }

  spanContext.addIntrinsicAttribute('transaction.name', name)
}

/**
 * Sets the transaction's name and determines if it will be ignored.
 *
 * @param {string} [name]
 *  Optional. The partial name to use for the finalized transaction. If omitted
 *  the current partial name is used.
 * @returns {undefined} undefined, finalizing name as a side effect
 */
Transaction.prototype.finalizeName = function finalizeName(name) {
  // If no name is given, and this is a web transaction with a url, then
  // finalize the name using the stored url.
  if (name == null && this.isWeb() && this.url) {
    return this.finalizeNameFromWeb(this.statusCode)
  }

  // this may seem out of place but certain API methods
  // set the _partialName directly so use that as a fallback
  this._partialName = name || this._partialName

  name = this.getFullName()

  if (!name) {
    logger.debug('No name for transaction %s, not finalizing.', this.id)
    return
  }

  this.name = name

  if (this.forceIgnore !== null) {
    this.ignore = this.forceIgnore
  }

  this.baseSegment && this.baseSegment.setNameFromTransaction(this)

  this._copyNameToActiveSpan(this.name)

  if (logger.traceEnabled()) {
    logger.trace(
      {
        transactionId: this.id,
        transactionName: this.name,
        ignore: this.ignore
      },
      'Finished setting transaction name from string'
    )
  }
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
 *
 * @returns {string} finalized name value or partial name
 */
Transaction.prototype.getName = function getName() {
  if (this.isWeb() && this.url) {
    const finalName = this._partialNameFromUri()
    if (finalName.ignore) {
      this.ignore = true
    }
    return finalName.value
  }
  return this._partialName
}

Transaction.prototype.getFullName = function getFullName() {
  let name = null
  // use value from `api.setTransaction`
  if (this.forceName) {
    name = this.forceName
    // use value from previously finalized named
  } else if (this.name) {
    return this.name
    // derive name from uri in web case
    // or just use whatever was this._partialName
  } else {
    name = this.getName()
  }

  if (!name) {
    return null
  }

  this._partialName = name
  let fullName = TYPE_METRICS[this.type] + '/' + name
  const normalized = this.agent.transactionNameNormalizer.normalize(fullName)
  if (normalized.ignore) {
    this.ignore = true
  }

  fullName = normalized.value

  // apply transaction segment term normalizer
  // only to web transactions
  if (this.isWeb() && this.url) {
    fullName = this.agent.txSegmentNormalizer.normalize(fullName).value
  }

  return fullName
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
  const name = this.name
  for (let i = 0, l = this._recorders.length; i < l; ++i) {
    this._recorders[i](name, this)
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
 * @param {number} keyApdexInMillis Duration sent to the metrics getOrCreateApdexMetric method, to
 *                                  derive apdex from timing in milliseconds
 */
Transaction.prototype._setApdex = function _setApdex(name, duration, keyApdexInMillis) {
  if (this.ignoreApdex) {
    logger.warn('Ignoring the collection of apdex stats for %s as ignoreApdex is true', this.name)
    return
  }

  const apdexStats = this.metrics.getOrCreateApdexMetric(name, null, keyApdexInMillis)

  // if we have an error-like status code, and all the errors are
  // expected, we know the status code was caused by an expected
  // error, so we will not report "frustrating."  Otherwise, we
  // don't know which error triggered the error-like status code,
  // and will still increment "frustrating."  If this is an issue,
  // users can either set a status code as expected, or ignore the
  // specific error to avoid incrementing to frustrating
  if (
    urltils.isError(this.agent.config, this.statusCode) &&
    !urltils.isExpectedError(this.agent.config, this.statusCode) &&
    !this.hasOnlyExpectedErrors()
  ) {
    apdexStats.incrementFrustrating()
  } else {
    apdexStats.recordValueInMillis(duration, keyApdexInMillis)
  }
}

/**
 * Store first 10 unique path hashes calculated for a transaction.
 *
 * @param {string} pathHash Path hash
 * @returns {undefined}
 */
Transaction.prototype.pushPathHash = function pushPathHash(pathHash) {
  if (this.pathHashes.length >= 10 || this.pathHashes.indexOf(pathHash) !== -1) {
    return
  }
  this.pathHashes.unshift(pathHash)
}

/**
 * Return whether transaction spawned any outbound requests.
 *
 * @returns {boolean} if there are more than zero pathHashes
 */
Transaction.prototype.includesOutboundRequests = function includesOutboundRequests() {
  return this.pathHashes.length > 0
}

/**
 * Get unique previous path hashes for a transaction. Does not include
 * current path hash.
 *
 * @returns {(string|null)} Returns sorted altHashes joined by commas, or null.
 */
Transaction.prototype.alternatePathHashes = function alternatePathHashes() {
  const curHash = hashes.calculatePathHash(
    this.agent.config.applications()[0],
    this.getFullName(),
    this.referringPathHash
  )
  const altHashes = this.pathHashes.slice()
  const curIndex = altHashes.indexOf(curHash)

  if (curIndex !== -1) {
    altHashes.splice(curIndex, 1)
  }

  return altHashes.length === 0 ? null : altHashes.sort().join(',')
}

/**
 * Add the error information to the current segment and add the segment ID as
 * an attribute onto the exception.
 *
 * @param {Exception} exception  The exception object to be collected.
 * @param {Segment}   segment    The segment to which the exception is linked.
 */
Transaction.prototype._linkExceptionToSegment = _linkExceptionToSegment

function _linkExceptionToSegment(exception, segment) {
  segment = segment || this.agent.tracer.getSegment()
  if (!segment) {
    return
  }

  const spanContext = segment.getSpanContext()
  if (spanContext) {
    // Exception attributes will be added to span unless transaction
    // status code has been ignored. Last error wins.
    const config = this.agent.config
    const details = exception.getErrorDetails(config)
    spanContext.setError(details)
  }

  // Add the span/segment ID to the exception as agent attributes
  exception.agentAttributes.spanId = segment.id
}

/**
 * Associate an exception with the transaction.  When the transaction ends,
 * the exception will be collected along with the transaction details.
 *
 * @param {Exception}   exception  The exception object to be collected.
 * @param {Segment}     segment    The segment to which the exception is linked.
 */
Transaction.prototype.addException = _addException

function _addException(exception, segment) {
  if (!this.isActive()) {
    logger.trace('Transaction is not active. Not capturing error: ', exception)
    return
  }

  this._linkExceptionToSegment(exception, segment)
  this.exceptions.push(exception)
}

/**
 * Associate a user error (reported using the noticeError() API) with the transaction.
 * When the transaction ends, the exception will be collected along with the transaction
 * details.
 *
 * @param {Exception}  exception  The exception object to be collected.
 */
Transaction.prototype.addUserError = _addUserError

function _addUserError(exception) {
  if (!this.isActive()) {
    logger.trace('Transaction is not active. Not capturing user error: ', exception)
    return
  }

  this._linkExceptionToSegment(exception)
  this.userErrors.push(exception)
}

/**
 * @returns {boolean} true if the transaction's current status code is errored
 * but considered ignored via the config.
 */
Transaction.prototype.hasIgnoredErrorStatusCode = function _hasIgnoredErrorStatusCode() {
  return urltils.isIgnoredError(this.agent.config, this.statusCode)
}

/**
 * @returns {boolean} true if an error happened during the transaction or if the transaction itself is
 * considered to be an error.
 */
Transaction.prototype.hasErrors = function _hasErrors() {
  const isErroredTransaction = urltils.isError(this.agent.config, this.statusCode)
  const transactionHasExceptions = this.exceptions.length > 0
  const transactionHasUserErrors = this.userErrors.length > 0
  return transactionHasExceptions || transactionHasUserErrors || isErroredTransaction
}

/**
 * @returns {boolean} true if all the errors/exceptions collected so far are expected errors
 */
Transaction.prototype.hasOnlyExpectedErrors = function hasOnlyExpectedErrors() {
  if (this.exceptions.length === 0) {
    return false
  }

  for (let i = 0; i < this.exceptions.length; i++) {
    const exception = this.exceptions[i]
    // this exception is neither expected nor ignored
    const isUnexpected = !(
      errorHelper.isExpectedException(this, exception, this.agent.config, urltils) ||
      errorHelper.shouldIgnoreError(this, exception.error, this.agent.config)
    )
    if (isUnexpected) {
      return false
    }
  }
  return true
}

/**
 * @returns {object} agent intrinsic attribute for this transaction.
 */
Transaction.prototype.getIntrinsicAttributes = function getIntrinsicAttributes() {
  if (!this._intrinsicAttributes.totalTime) {
    const config = this.agent.config
    this._intrinsicAttributes.totalTime = this.trace.getTotalTimeDurationInMillis() * FROM_MILLIS

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
        this._intrinsicAttributes.referring_transaction_guid = this.referringTransactionGuid
      }
      if (this.incomingCatId) {
        this._intrinsicAttributes.client_cross_process_id = this.incomingCatId
      }
    }

    synthetics.assignIntrinsicsToTransaction(this)
  }
  return Object.assign(Object.create(null), this._intrinsicAttributes)
}

/**
 * Parsing incoming headers for use in a distributed trace.
 * W3C TraceContext format is preferred over the NewRelic DT format.
 * NewRelic DT format will be used if no `traceparent` header is found.
 *
 * @param {string} [transport='Unknown'] - The transport type that delivered the trace.
 * @param {object} headers - Headers to search for supported trace formats. Keys must be lowercase.
 */
Transaction.prototype.acceptDistributedTraceHeaders = acceptDistributedTraceHeaders
function acceptDistributedTraceHeaders(transportType, headers) {
  if (headers == null || typeof headers !== 'object') {
    logger.trace(
      'Ignoring distributed trace headers for transaction %s. Headers not passed in as object.',
      this.id
    )
    return
  }

  const transport = TRANSPORT_TYPES_SET[transportType] ? transportType : TRANSPORT_TYPES.UNKNOWN

  // assumes header keys already lowercase
  const traceparentHeader = headers[TRACE_CONTEXT_PARENT_HEADER]?.toString('utf8')
  const tracestateHeader = headers[TRACE_CONTEXT_STATE_HEADER]?.toString('utf8')

  if (traceparentHeader) {
    logger.trace('Accepting trace context DT payload for transaction %s', this.id)
    this.acceptTraceContextPayload(traceparentHeader, tracestateHeader, transport)
  } else if (NEWRELIC_TRACE_HEADER in headers) {
    logger.trace('Accepting newrelic DT payload for transaction %s', this.id)
    // assumes header keys already lowercase
    const payload = headers[NEWRELIC_TRACE_HEADER]
    this._acceptDistributedTracePayload(payload, transport)
  }
}

/**
 * Inserts distributed trace headers into the provided headers map.
 *
 * @param {object} headers
 * @param {object} setter - otel bridge setter to assign headers
 * @param {object} spanContext otel span context
 */
Transaction.prototype.insertDistributedTraceHeaders = insertDistributedTraceHeaders
function insertDistributedTraceHeaders(headers, setter, spanContext) {
  if (!headers) {
    logger.trace('insertDistributedTraceHeaders called without headers.')
    return
  }

  checkForExistingNrTraceHeaders(headers)

  // Ensure we have priority before generating trace headers.
  this.agent.samplers.applySamplingDecision({ transaction: this })
  this.traceContext.addTraceContextHeaders(headers, setter, spanContext)
  this.isDistributedTrace = true

  logger.trace('Added outbound request w3c trace context headers in transaction %s', this.id)

  if (this.agent.config.distributed_tracing.exclude_newrelic_header) {
    logger.trace('Excluding newrelic header due to exclude_newrelic_header: true')
    return
  }

  try {
    const newrelicFormatData = this._createDistributedTracePayload().httpSafe()
    if (newrelicFormatData) {
      headers[NEWRELIC_TRACE_HEADER] = newrelicFormatData
      logger.trace('Added outbound request distributed tracing headers in transaction %s', this.id)
    }
  } catch (error) {
    logger.trace(error, 'Failed to create distributed trace payload')
  }
}

function checkForExistingNrTraceHeaders(headers) {
  const traceparentHeader = headers[TRACE_CONTEXT_PARENT_HEADER]
  const newrelicHeader = headers[NEWRELIC_TRACE_HEADER]

  const hasExisting = traceparentHeader || newrelicHeader
  if (hasExisting) {
    logger.trace(MULTIPLE_INSERT_MESSAGE, traceparentHeader, newrelicHeader)
  }
}

Transaction.prototype.acceptTraceContextPayload = acceptTraceContextPayload
function acceptTraceContextPayload(traceparentHeader, tracestateHeader, transport) {
  if (this.isDistributedTrace) {
    logger.warn(
      'Already accepted or created a distributed trace payload for transaction %s, ignoring call',
      this.id
    )

    if (this.acceptedDistributedTrace) {
      this.agent.recordSupportability('TraceContext/Accept/Ignored/Multiple')
    } else {
      this.agent.recordSupportability('TraceContext/Accept/Ignored/CreateBeforeAccept')
    }

    return
  }

  const { traceparent, tracestate } = this.traceContext.acceptTraceContextPayload(traceparentHeader, tracestateHeader)
  if (traceparent === undefined) {
    // If the traceparent wasn't accepted, there isn't anything to do. Per spec,
    // the trace state should not be used if the traceparent is not provided
    // or is not valid.
    return
  }

  this.acceptedDistributedTrace = true
  this.isDistributedTrace = true

  this.traceId = traceparent.traceId
  this.parentSpanId = traceparent.parentId
  this.parentTransportType = transport

  if (tracestate !== undefined && tracestate.intrinsics?.isValid === true) {
    // Add properties that are only available if we have a New Relic tracestate
    // list member present.
    this.parentType = tracestate.parentType
    this.parentAcct = tracestate.parentAccountId
    this.parentApp = tracestate.parentAppId
    this.parentId = tracestate.transactionId
    if (tracestate.timestamp != null) {
      this.parentTransportDuration = Math.max(0, (Date.now() - tracestate.timestamp) / 1_000)
    }
  }

  this.agent.samplers.applyDTSamplingDecision({ transaction: this, traceparent, tracestate })
}

/*
  The following underscored functions are used exclusively by the
  _acceptDistributedTracePayload method. They're broken out to reduce
  its cognitive complexity.
 */
const _dtPayloadTest = function _dtPayloadTest(payload) {
  if (!payload) {
    this.agent.recordSupportability('DistributedTrace/AcceptPayload/Ignored/Null')
  }
  return !!payload
}
const _isDtTest = function _isDtTest() {
  if (this.isDistributedTrace) {
    logger.warn(
      'Already accepted or created a distributed trace payload for transaction %s, ignoring call',
      this.id
    )
    let supportabilityMetric = 'DistributedTrace/AcceptPayload/Ignored/CreateBeforeAccept'
    if (this.parentId) {
      supportabilityMetric = 'DistributedTrace/AcceptPayload/Ignored/Multiple'
    }
    this.agent.recordSupportability(supportabilityMetric)
    return true
  }
  return false
}
const _dtConfigTest = function _dtConfigTest() {
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

    this.agent.recordSupportability(DT_ACCEPT_PAYLOAD_EXCEPTION_METRIC)
    return false
  }
  return trustedAccount
}
const _dtParseTest = function _dtParseTest(payload) {
  const parsed = this._getParsedPayload(payload)

  if (!parsed) {
    return false
  }

  if (!parsed.v) {
    logger.warn('Received a distributed trace payload with no version field', this.id)
  }
  if (!parsed.d) {
    logger.warn('Received a distributed trace payload with no data field', this.id)
  }
  if (!parsed.v || !parsed.d) {
    this.agent.recordSupportability(DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC)
    return false
  }
  return parsed
}
const _dtVersionTest = function _dtVersionTest(parsed) {
  const majorVersion = parsed.v && typeof parsed.v[0] === 'number' && parsed.v[0]

  if (majorVersion === null) {
    logger.warn('Invalid distributed trace payload, not accepting')
    this.agent.recordSupportability(DT_ACCEPT_PAYLOAD_EXCEPTION_METRIC)
  }
  if (majorVersion > 0) {
    // TODO: Add DistributedTracePayload class?
    this.agent.recordSupportability('DistributedTrace/AcceptPayload/Ignored/MajorVersion')
  }
  return majorVersion
}
const _dtRequiredKeyTest = function _dtRequiredKeyTest(data) {
  return REQUIRED_DT_KEYS.every(function checkExists(key) {
    return data[key] != null
  })
}
const _dtSpanParentTest = function _dtSpanParentTest(requiredKeysExist, data) {
  // Either parentSpanId or parentId are required.
  if (!requiredKeysExist || (data.tx == null && data.id == null)) {
    this.agent.recordSupportability(DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC)
    return false
  }
  return true
}
const _dtDefineAttrsFromTraceData = function _dtDefineAttrsFromTraceData(data, transport) {
  this.parentType = data.ty
  this.parentApp = data.ap
  this.parentAcct = data.ac
  this.parentTransportType = transport
  this.parentTransportDuration = Math.max(0, (Date.now() - data.ti) / 1000)
  this.traceId = data.tr

  if (data.pr) {
    this.priority = data.pr
    this.sampled = data.sa != null ? data.sa : this.sampled

    this.agent.samplers.applyLegacyDTSamplingDecision({ transaction: this, isSampled: data?.sa })
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
 * Parses incoming distributed trace header payload.
 *
 * @param {object} payload                - The distributed trace payload to accept.
 * @param {string} [transport='Unknown']  - The transport type that delivered the payload.
 */
Transaction.prototype._acceptDistributedTracePayload = _acceptDistributedTracePayload
function _acceptDistributedTracePayload(payload, transport) {
  const payloadTest = _dtPayloadTest.bind(this)
  if (!payloadTest(payload)) {
    return
  }

  const isDtTest = _isDtTest.bind(this)
  if (isDtTest()) {
    return
  }

  const configTest = _dtConfigTest.bind(this)
  const configTestResult = configTest()
  if (!configTestResult) {
    return
  }

  const traceParseTest = _dtParseTest.bind(this)
  const parsed = traceParseTest(payload)
  if (!parsed) {
    return
  }

  const traceVersionTest = _dtVersionTest.bind(this)
  if (traceVersionTest(parsed) > 0) {
    return
  }

  const data = parsed.d

  if (!data) {
    logger.warn('No distributed trace data received, not accepting payload')
    this.agent.recordSupportability(DT_ACCEPT_PAYLOAD_EXCEPTION_METRIC)
    return
  }

  const requiredKeyTest = _dtRequiredKeyTest.bind(this)
  const requiredKeysExist = requiredKeyTest(data)
  const spanParentTest = _dtSpanParentTest.bind(this)
  const spanParentResult = spanParentTest(requiredKeysExist, data)

  if (!spanParentResult) {
    return
  }

  const trustedAccount = configTestResult
  const trustedAccountKey = data.tk || data.ac
  if (trustedAccountKey !== trustedAccount) {
    this.agent.recordSupportability('DistributedTrace/AcceptPayload/Ignored/UntrustedAccount')
    return
  }

  const defineAttrsFromTraceData = _dtDefineAttrsFromTraceData.bind(this)
  defineAttrsFromTraceData(data, transport)
}

/**
 * Returns parsed payload object after attempting to decode it from base64,
 * and parsing the JSON string.
 *
 * @param {string} payload Payload string to be JSON.parsed
 * @returns {(object|null)} parsed JSON payload or null
 */
Transaction.prototype._getParsedPayload = function _getParsedPayload(payload) {
  let parsed = payload

  if (typeof payload === 'string') {
    if (payload.charAt(0) !== '{' && payload.charAt(0) !== '[') {
      try {
        payload = Buffer.from(payload, 'base64').toString('utf-8')
      } catch (err) {
        logger.warn(err, 'Got unparsable distributed trace payload in transaction %s', this.id)
        this.agent.recordSupportability(DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC)
        return null
      }
    }
    try {
      parsed = JSON.parse(payload)
    } catch (err) {
      logger.warn(err, 'Failed to parse distributed trace payload in transaction %s', this.id)
      this.agent.recordSupportability(DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC)
      return null
    }
  }

  return parsed
}

/**
 * Creates a distributed trace payload.
 */
Transaction.prototype._createDistributedTracePayload = _createDistributedTracePayload

function _createDistributedTracePayload() {
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

  const currSegment = this.agent.tracer.getSegment()
  const data = {
    ty: 'App',
    ac: accountId,
    ap: appId,
    tx: this.id,
    tr: this.traceId,
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
 * Adds distributed trace attributes to intrinsics object.
 */
Transaction.prototype.addDistributedTraceIntrinsics = addDistributedTraceIntrinsics
function addDistributedTraceIntrinsics(attrs) {
  // Apply sampling decision if not already made
  this.agent.samplers.applySamplingDecision({ transaction: this })
  // *always* add these if DT flag is enabled.
  attrs.traceId = this.traceId
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

Transaction.prototype.isSampled = function isSampled() {
  this.agent.samplers.applySamplingDecision({ transaction: this })
  return this.sampled
}

function _makeValueSet(obj) {
  return Object.keys(obj)
    .map((t) => obj[t])
    .reduce(function reduceToMap(o, t) {
      o[t] = true
      return o
    }, Object.create(null))
}

Transaction.prototype.addRequestParameters = addRequestParameters

/**
 * Adds query parameters to create attributes in the form
 * 'request.parameters.{key}'. These attributes will only be created
 * when 'request.parameters.*' is included in the attribute config.
 *
 * Used by the "serverless mode" lambda logic
 *
 * @param {Object<string, string>} requestParameters of the request object
 */
function addRequestParameters(requestParameters) {
  requestParameters ??= {}
  for (const [key, value] of Object.entries(requestParameters)) {
    this.trace.attributes.addAttribute(
      DESTS.NONE,
      QUERY_PARAMS_PATH + key,
      value
    )

    const segment = this.baseSegment

    segment.attributes.addAttribute(DESTS.NONE, QUERY_PARAMS_PATH + key, value)
  }
}

/**
 * Increments counters used to report details.
 * `numSegments` - recorded as supportability metric when transaction ends
 * `agent.totalActiveSegments` used as a trace level log value when metrics are harvested
 * `agent.segmentsCreatedInHarvest` used as a trace level log value when metrics are harvested
 */
Transaction.prototype.incrementCounters = function incrementCounters() {
  ++this.numSegments
  this.agent.incrementCounters()
}

/**
 * Initializes a web transaction with request information:
 *  Assigns type(web), verb, url, port attributes on transaction.
 *  Collects request headers as attributes on the transaction.
 *  Applies user naming rules to the transaction.
 *  Calculates queue time if possible.
 *  Assigns synthetics information if present.
 *  Adds distributed trace or cat headers if present.
 *
 * @param {object} params - Parameters to initialize the web transaction.
 * @param {string} params.absoluteUrl - Full URL of the request.
 * @param {string} params.method - HTTP method of the request.
 * @param {number} params.port - Port of the request.
 * @param {object} [params.headers] - HTTP headers of the request.
 * @param {string} [params.transport] - Transport type that delivered the request.
 */
Transaction.prototype.initializeWeb = function initializeWeb({ absoluteUrl, method, port, headers = {}, transport }) {
  this.type = TYPES.WEB
  headerAttributes.collectRequestHeaders(headers, this)

  if (method != null) {
    this.trace.attributes.addAttribute(DESTS.TRANS_COMMON, 'request.method', method)
    this.baseSegment.addSpanAttribute('request.method', method)
    this.verb = method
  }

  this.port = port

  // the error tracer needs a URL for tracing, even though naming overwrites
  try {
    const parsedUrl = new URL(absoluteUrl)
    const data = urltils.scrubAndParseParameters(parsedUrl)
    this.url = data.path
    this.addRequestParameters(data.parameters)
  } catch (err) {
    logger.debug('Could not parse URL %s: %s', absoluteUrl, err.message)
    this.url = '/unknown'
  }

  // need to set any config-driven names early for RUM
  logger.trace({ url: this.url, transaction: this.id },
    'Applying user naming rules for RUM.')

  this.applyUserNamingRules(this.url)

  const queueTimeStamp = headerProcessing.getQueueTime(logger, headers)
  if (queueTimeStamp) {
    this.queueTime = Date.now() - queueTimeStamp
  }

  synthetics.assignHeadersToTransaction(this.agent.config, this, headers)
  this.addDtCatHeaders({ headers, transport })
}

/**
 * Handles accepting upstream DT headers(traceparent/tracestate or newrelic) if present and DT is enabled.
 * If CAT is enabled, handles accepting CAT headers and assigns to transaction.
 *
 * @param {object} params - Parameters for adding DT or CAT headers.
 * @param {object} params.headers - HTTP headers of the request(must be lower-cased, by default http instrumentation has headers lower case, other libraries must pass this in lowercased).
 * @param {string} [params.transport] - Transport type that delivered the request.
 */
Transaction.prototype.addDtCatHeaders = function addDtCatHeaders({ headers, transport }) {
  if (this.agent.config.distributed_tracing.enabled) {
    // Node http request headers are automatically lowercase
    // need to pass in lower case for other instrumentation
    this.acceptDistributedTraceHeaders(transport, headers)
  } else if (this.agent.config.cross_application_tracer.enabled) {
    const { id, transactionId } = cat.extractCatHeaders(headers)
    const { externalId, externalTransaction } = cat.parseCatData(
      id,
      transactionId,
      this.agent.config.encoding_key
    )
    cat.assignCatToTransaction(externalId, externalTransaction, this)
  }
}

module.exports = Transaction
