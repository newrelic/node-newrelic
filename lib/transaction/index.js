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
const props = require('../util/properties')
const Timer = require('../timer')
const Trace = require('./trace')
const url = require('url')
const urltils = require('../util/urltils')
const TraceContext = require('./tracecontext').TraceContext
const Logs = require('./logs')
const DT_ACCEPT_PAYLOAD_EXCEPTION_METRIC = 'DistributedTrace/AcceptPayload/Exception'
const DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC = 'DistributedTrace/AcceptPayload/ParseException'
const REQUEST_PARAMS_PATH = 'request.parameters.'

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

const TRACE_CONTEXT_PARENT_HEADER = 'traceparent'
const TRACE_CONTEXT_STATE_HEADER = 'tracestate'
const NEWRELIC_TRACE_HEADER = 'newrelic'

const MULTIPLE_INSERT_MESSAGE =
  'insertDistributedTraceHeaders called on headers object that already contains ' +
  "distributed trace data. These may be overwritten. traceparent? '%s', newrelic? '%s'."

/**
 * Bundle together the metrics and the trace segment for a single agent
 * transaction.
 *
 * @param {object} agent The agent.
 */
function Transaction(agent) {
  if (!agent) {
    throw new Error('every transaction must be bound to the agent')
  }

  this.traceFlag = false
  if (agent.config.logging.diagnostics) {
    this.traceStacks = []
  } else {
    this.traceStacks = null
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
  this._traceId = null
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

  // LLM fields.
  this.llm = {
    responses: new Map()
  }

  // Lazy evaluate the priority and sampling in case we end up accepting a payload.
  this.priority = null
  this.sampled = null
  this.traceContext = new TraceContext(this)
  this.logs = new Logs(agent)

  agent.emit('transactionStarted', this)
  this.probe('Transaction created', { id: this.id })
}

Transaction.TYPES = TYPES
Transaction.TYPES_SET = TYPES_SET
Transaction.TRANSPORT_TYPES = TRANSPORT_TYPES
Transaction.TRANSPORT_TYPES_SET = TRANSPORT_TYPES_SET
Transaction.TRACE_CONTEXT_PARENT_HEADER = TRACE_CONTEXT_PARENT_HEADER

Transaction.prototype.probe = function probe(action, extra) {
  if (this.traceStacks) {
    this.traceStacks.push({
      stack: new Error(action).stack.split('\n'),
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
 * @returns {boolean} Is this transaction still alive?
 */
Transaction.prototype.isActive = function isActive() {
  return this.timer.isActive()
}

/**
 * Close out the current transaction and its associated trace. Remove any
 * instances of this transaction annotated onto the call stack.
 *
 * @returns {(Transaction|undefined)} this transaction, or undefined
 */
Transaction.prototype.end = function end() {
  if (!this.timer.isActive()) {
    return
  }
  if (this.traceFlag) {
    logger.warn(
      { segment: { name: this.name, stacks: this.traceStacks } },
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
    this.logs.flush(this.priority)
  }

  this.agent.emit('transactionFinished', this)

  // Do after emit so all post-processing can complete
  this._cleanUneededReferences()

  return this
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
Transaction.prototype._cleanUneededReferences = function _cleanUneededReferences() {
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
function _partialNameFromUri(requestUrl, status) {
  const scrubbedUrl = urltils.scrub(requestUrl)

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
    ignore: ignore,
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
  if (logger.traceEnabled()) {
    logger.trace(
      {
        requestURL: requestURL,
        statusCode: statusCode,
        transactionId: this.id,
        transactionName: this.name
      },
      'Setting transaction name'
    )
  }

  this.url = urltils.scrub(requestURL)
  this.statusCode = statusCode
  this.name = this.getFullName()

  // If a namestate stack exists, copy route parameters over to the trace.
  if (!this.nameState.isEmpty() && this.baseSegment) {
    this.nameState.forEachParams(forEachRouteParams, this)
  }

  // Allow the API to explicitly set the ignored status.
  if (this.forceIgnore !== null) {
    this.ignore = this.forceIgnore
  }

  this.baseSegment && this._markAsWeb(requestURL)

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

function forEachRouteParams(params) {
  for (const key in params) {
    if (props.hasOwn(params, key)) {
      this.trace.attributes.addAttribute(DESTS.NONE, key, params[key])

      const segment = this.agent.tracer.getSegment()

      if (!segment) {
        logger.trace(
          'Active segment not available, not adding request.parameters.route attribute for %s',
          key
        )
      } else {
        segment.attributes.addAttribute(DESTS.NONE, key, params[key])
      }
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
 * Copies final base segment parameters to trace attributes before reapplying
 * them to the segment.
 *
 * Handles adding query parameters to `request.parameter.*` attributes
 *
 * @param {string} rawURL The URL, as it came in, for parameter extraction.
 */
Transaction.prototype._markAsWeb = function _markAsWeb(rawURL) {
  // Because we are assured we have the URL here, lets grab query params.
  const params = urltils.parseParameters(rawURL)
  for (const key in params) {
    if (props.hasOwn(params, key)) {
      this.trace.attributes.addAttribute(DESTS.NONE, REQUEST_PARAMS_PATH + key, params[key])

      const segment = this.agent.tracer.getSegment()

      if (!segment) {
        logger.trace(
          'Active segment not available, not adding request.parameters span attribute for %s',
          key
        )
      } else {
        segment.attributes.addAttribute(DESTS.NONE, REQUEST_PARAMS_PATH + key, params[key])
      }
    }
  }
  this.baseSegment.markAsWeb()
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
    return this.finalizeNameFromUri(this.url, this.statusCode)
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

  this.baseSegment && this.baseSegment.setNameFromTransaction()

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
    const finalName = this._partialNameFromUri(this.url, this.statusCode)
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
 * Returns the full URL of the transaction with query, search, or hash portions
 * removed. This is only applicable for web transactions.
 *
 * Caches to ._scrubbedUrl, pulls in from .parsedUrl if it is available,
 * otherwise it will parse .url, store it on .parsedUrl, then scrub the URL and
 * store it in the cache.
 *
 * @returns {(string|undefined)} Returns a string or undefined.
 */
Transaction.prototype.getScrubbedUrl = function getScrubbedUrl() {
  if (!this.isWeb()) {
    return
  }
  if (this._scrubbedUrl) {
    return this._scrubbedUrl
  }

  // If we don't have a parsedUrl, lets populate it from .url
  if (!this.parsedUrl) {
    // At time of writing .url should always be set by the time we get here
    // because that is what .isWeb() checks against. In the future it may be
    // instead checking a enum or other property so guard ourselves just in
    // case.
    if (!this.url) {
      return
    }
    this.parsedUrl = url.parse(this.url)
  }

  const scrubbedParsedUrl = Object.assign(Object.create(null), this.parsedUrl)
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
  const name = this.name
  for (let i = 0, l = this._recorders.length; i < l; ++i) {
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
 * @param {number} keyApdexInMillis Duration sent to the metrics getOrCreateApdexMetric method, to
 *                                  derive apdex from timing in milliseconds
 */
Transaction.prototype._setApdex = function _setApdex(name, duration, keyApdexInMillis) {
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
 */
Transaction.prototype._linkExceptionToSegment = _linkExceptionToSegment

function _linkExceptionToSegment(exception) {
  const segment = this.agent.tracer.getSegment()
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
 */
Transaction.prototype.addException = _addException

function _addException(exception) {
  if (!this.isActive()) {
    logger.trace('Transaction is not active. Not capturing error: ', exception)
    return
  }

  this._linkExceptionToSegment(exception)
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
  const transactionHasuserErrors = this.userErrors.length > 0
  return transactionHasExceptions || transactionHasuserErrors || isErroredTransaction
}

/**
 * @returns {boolean} true if all the errors/exceptions collected so far are expected errors
 */
Transaction.prototype.hasOnlyExpectedErrors = function hasOnlyExpectedErrors() {
  if (0 === this.exceptions.length) {
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

    if (this.syntheticsData) {
      this._intrinsicAttributes.synthetics_resource_id = this.syntheticsData.resourceId
      this._intrinsicAttributes.synthetics_job_id = this.syntheticsData.jobId
      this._intrinsicAttributes.synthetics_monitor_id = this.syntheticsData.monitorId
    }
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
  const traceparent = headers[TRACE_CONTEXT_PARENT_HEADER]

  if (traceparent) {
    logger.trace('Accepting trace context DT payload for transaction %s', this.id)
    // assumes header keys already lowercase
    const tracestate = headers[TRACE_CONTEXT_STATE_HEADER]
    this.acceptTraceContextPayload(traceparent, tracestate, transport)
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
 */
Transaction.prototype.insertDistributedTraceHeaders = insertDistributedTraceHeaders
function insertDistributedTraceHeaders(headers) {
  if (!headers) {
    logger.trace('insertDistributedTraceHeaders called without headers.')
    return
  }

  checkForExistingNrTraceHeaders(headers)

  // Ensure we have priority before generating trace headers.
  this._calculatePriority()

  this.traceContext.addTraceContextHeaders(headers)
  this.isDistributedTrace = true

  logger.trace('Added outbound request w3c trace context headers in transaction %s', this.id)

  if (this.agent.config.distributed_tracing.exclude_newrelic_header) {
    logger.trace('Excluding newrelic header due to exclude_newrelic_header: true')
    return
  }

  try {
    const newrelicFormatData = this._createDistributedTracePayload().httpSafe()
    headers[NEWRELIC_TRACE_HEADER] = newrelicFormatData
    logger.trace('Added outbound request distributed tracing headers in transaction %s', this.id)
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
function acceptTraceContextPayload(traceparent, tracestate, transport) {
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

  const traceContext = this.traceContext.acceptTraceContextPayload(traceparent, tracestate)

  if (traceContext.acceptedTraceparent) {
    this.acceptedDistributedTrace = true
    this.isDistributedTrace = true

    this.traceId = traceContext.traceId
    this.parentSpanId = traceContext.parentSpanId
    this.parentTransportDuration = traceContext.transportDuration
    this.parentTransportType = transport

    if (traceContext.acceptedTracestate) {
      this.parentType = traceContext.parentType
      this.parentAcct = traceContext.accountId
      this.parentApp = traceContext.appId
      this.parentId = traceContext.transactionId
      this.sampled = traceContext.sampled
      this.priority = traceContext.priority
    }
  }
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
    this.agent.recordSupportability(`DistributedTrace/AcceptPayload/Ignored/UntrustedAccount`)
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
        logger.warn(err, 'Got unparseable distributed trace payload in transaction %s', this.id)
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
 * Adds distributed trace attributes to instrinsics object.
 */
Transaction.prototype.addDistributedTraceIntrinsics = addDistributedTraceIntrinsics
function addDistributedTraceIntrinsics(attrs) {
  this._calculatePriority()

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
  this._calculatePriority()
  return this.sampled
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
    this.priority = ((this.priority * 1e6) | 0) / 1e6
  }
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
  for (const key in requestParameters) {
    if (props.hasOwn(requestParameters, key)) {
      this.trace.attributes.addAttribute(
        DESTS.NONE,
        REQUEST_PARAMS_PATH + key,
        requestParameters[key]
      )

      const segment = this.baseSegment

      segment.attributes.addAttribute(DESTS.NONE, REQUEST_PARAMS_PATH + key, requestParameters[key])
    }
  }
}

module.exports = Transaction
