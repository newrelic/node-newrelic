'use strict'

var urltils = require('../util/urltils.js')
var Metrics = require('../metrics')
var Timer = require('../timer.js')
var Trace = require('./trace')
var NAMES = require('../metrics/names.js')
var hashes = require('../util/hashes')

/**
 * Bundle together the metrics and the trace segment for a single agent
 * transaction.
 *
 * @param {Object} agent The agent.
 */
function Transaction(agent) {
  if (!agent) throw new Error('every transaction must be bound to the agent')

  this.agent = agent
  this.metrics = new Metrics(
    agent.config.apdex_t,
    agent.mapper,
    agent.metricNameNormalizer
  )

  // This number needs to be unique so the previous method of picking 1337 then
  // incrementing it no longer works. 1e17 should always result in a whole
  // number, but just in case we floor it so we don't end up with decimals. Then
  // we make it hex because other agents use a hex based transaction id.
  this.id = Math.floor((Math.random() * 1e17)).toString(16)

  this.trace = new Trace(this)
  this.exceptions = []
  this.timer = new Timer()
  this.timer.begin()

  this._recorders = []

  // hidden class optimization
  this.bgSegment = null
  this.catResponseTime = 0
  this.error = null
  this.forceIgnore = null
  this.ignore = false
  this.incomingCatId = null
  this.name = null
  this.partialName = null
  this.pathHashes = []
  this.queueTime = 0
  this.statusCode = null
  this.syntheticsHeader = null
  this.syntheticsData = null
  this.url = null
  this.parsedUrl = null
  this.verb = null
  this.webSegment = null
}

/**
 * Add a clear API method for determining whether a transaction is web or
 * background.
 *
 * @returns {boolean} Whether this transaction has a URL.
 */
Transaction.prototype.isWeb = function isWeb() {
  return this.url ? true : false
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
Transaction.prototype.end = function end(done) {
  if (!this.timer.isActive()) return

  var transaction = this

  transaction.trace.end()
  process.nextTick(function nextTickedEnd() {
    // recorders must be run before the trace is collected
    if (!transaction.ignore) {
      transaction.record()
    }

    transaction.agent.emit('transactionFinished', transaction)
    if (typeof done === 'function') {
      done(transaction)
    }
  })

  transaction.timer.end()
}

Transaction.prototype.applyUserNamingRules = function applyUserNamingRules(requestUrl) {
  // 1. user normalization rules (set in configuration)
  var normalizer = this.agent.userNormalizer
  if (normalizer.isIgnored(requestUrl)) this.ignore = true
  // User rules take precedence over the API and router introspection.
  // Only override names set via API if rules match.
  if (normalizer.canNormalize(requestUrl)) {
    this.partialName = NAMES.NORMALIZED + normalizer.normalize(requestUrl)
  }
}

/**
 * Sets the name of this transaction, figuring out along the way whether the
 * transaction should be ignored. Should run as late in the transaction's
 * lifetime as possible.
 *
 * Works entirely via side effects.
 *
 * @param {string} requestURL The URL to extract the name from.
 * @param {string} statusCode The HTTP status code from the response.
 */
Transaction.prototype.setName = function setName(requestURL, statusCode) {
  var normalizer

  this.url = urltils.scrub(requestURL)
  this.statusCode = statusCode

  // 1. user normalization rules (set in configuration)
  this.applyUserNamingRules(this.url)

  // 2. URL normalization rules (sent by server)
  normalizer = this.agent.urlNormalizer
  if (normalizer.isIgnored(this.url)) this.ignore = true
  /* Nothing has already set a name for this transaction, so normalize and
   * potentially apply the URL backstop now. Only do so if no user rules
   * matched.
   */
  if (!this.partialName) this.partialName = normalizer.normalize(this.url)

  // 3. transaction name normalization rules (sent by server)
  normalizer = this.agent.transactionNameNormalizer
  var fullName = NAMES.WEB + '/' + this.partialName
  if (normalizer.isIgnored(fullName)) this.ignore = true
  // Always applied.
  this.name = normalizer.normalize(fullName)

  // 4. transaction segment term normalizer
  this.name = this.agent.txSegmentNormalizer.normalize(this.name)

  // Allow the API to explicitly set the ignored status.
  if (this.forceIgnore !== null) {
    this.ignore = this.forceIgnore
  }
}


Transaction.prototype.setBackgroundName = function setBackgroundName(name, group) {
  var fullName = NAMES.BACKGROUND + NAMES.ACTION_DELIMITER +
                 group + NAMES.ACTION_DELIMITER + name
  var normalizer = this.agent.transactionNameNormalizer
  if (normalizer.isIgnored(fullName)) this.ignore = true
  this.name = normalizer.normalize(fullName)

  if (this.forceIgnore !== null) {
    this.ignore = this.forceIgnore
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
 */
Transaction.prototype.getName = function getName() {
  // Detect web transactions as they are more complex.
  if (this.isWeb() && !this.name) {
    // Save and restore the partial name, as some instrumentation relies on it
    // not being set to detect if it should set the transaction name.
    var tempPartialName = this.partialName
    this.setName(this.url, this.statusCode)
    this.partialName = tempPartialName
  }
  return this.name
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
    apdexStats.recordValueInMillis(duration)
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
    this.name || this.partialName,
    this.referringPathHash
  )
  var altHashes = this.pathHashes.slice()
  var curIndex = altHashes.indexOf(curHash)

  if (curIndex !== -1) altHashes.splice(curIndex, 1)

  return altHashes.length === 0 ? null : altHashes.sort().join(',')
}

Transaction.prototype.cleanup = function cleanup() {
  if (this.trace) this.trace.cleanup()
}

module.exports = Transaction
