'use strict';

var path    = require('path')
  , urltils = require(path.join(__dirname, 'util', 'urltils.js'))
  , Metrics = require(path.join(__dirname, 'metrics.js'))
  , Timer   = require(path.join(__dirname, 'timer.js'))
  , Trace   = require(path.join(__dirname, 'transaction', 'trace.js'))
  , NAMES   = require(path.join(__dirname, 'metrics', 'names.js'))
  ;

/**
 * Simplifies development and debugging, not passed to collector
 */
var id = 1337;


/**
 * Bundle together the metrics and the trace segment for a single agent
 * transaction.
 *
 * @param {Object} agent The agent.
 */
function Transaction(agent) {
  if (!agent) throw new Error('every transaction must be bound to the agent');

  this.agent = agent;
  this.metrics = new Metrics(
    agent.config.apdex_t,
    agent.mapper,
    agent.metricNameNormalizer
  );

  this.id = id++;
  this.exceptions = [];
  this.timer = new Timer();
  this.timer.begin();

  // hidden class optimization
  this.url         = null;
  this.name        = null;
  this.partialName = null;
  this.statusCode  = null;
  this.error       = null;
  this.verb        = null;
  this.trace       = null;
  this.forceIgnore = null;
  this.ignore      = false;
}

/**
 * Return the associated transaction trace, creating it if necessary.
 */
Transaction.prototype.getTrace = function () {
  if (!this.trace) this.trace = new Trace(this);

  return this.trace;
};

/**
 * Add a clear API method for determining whether a transaction is web or
 * background.
 *
 * @returns {boolean} Whether this transaction has a URL.
 */
Transaction.prototype.isWeb = function () {
  return this.url ? true : false;
};

/**
 * @return {bool} Is this transaction still alive?
 */
Transaction.prototype.isActive = function () {
  return this.timer.isActive();
};

/**
 * Close out the current transaction and its associated trace. Remove any
 * instances of this transaction annotated onto the call stack.
 */
Transaction.prototype.end = function () {
  if (!this.timer.isActive()) return;

  this.timer.end();
  if (this.trace) this.trace.end();

  this.agent.emit('transactionFinished', this);
};

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
Transaction.prototype.setName = function (requestURL, statusCode) {
  this.url = urltils.scrub(requestURL);
  this.statusCode = statusCode;

  var normalizer = this.agent.userNormalizer
    , normalized = normalizer.normalize(this.url)
    ;

  // normalization rules can ignore a transaction
  if (!normalized) {
    this.ignore = true;
  }
  // only set the partial name if a user rule was actually applied
  else if (normalized !== this.url) {
    this.partialName = NAMES.NORMALIZED + normalized;
  }

  /* Nothing has already set a name for this transaction, so normalize and
   * potentially apply the URL backstop now.
   */
  if (!this.partialName) {
    this.partialName = this.agent.urlNormalizer.normalize(this.url);
  }

  // the URL normalizer returns no name if a path should be ignored
  if (this.partialName) {
    normalizer = this.agent.transactionNameNormalizer;
    normalized = normalizer.normalize(NAMES.WEB + '/' + this.partialName);

    if (!normalized) {
      this.ignore = true;
    }
    else {
      this.name = normalized;
    }
  }

  // allow the API to explicitly set the ignored status
  if (this.forceIgnore === true || this.forceIgnore === false) {
    this.ignore = this.forceIgnore;
  }
};

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
Transaction.prototype.measure = function (name, scope, duration, exclusive) {
  this.metrics.measureMilliseconds(name, scope, duration, exclusive);
};

/**
 * Based on the status code and the duration of a web transaction, either
 * mark the transaction as frustrating, or record its time for apdex purposes.
 *
 * @param {string} name     Metric name.
 * @param {number} duration Duration of the transaction, in milliseconds.
 * @param {number} keyApdex A key transaction apdexT, in milliseconds
 *                          (optional).
 */
Transaction.prototype._setApdex = function (name, duration, keyApdexInMillis) {
  var apdexStats = this.metrics.getOrCreateApdexMetric(name, null, keyApdexInMillis);
  if (urltils.isError(this.agent.config, this.statusCode)) {
    apdexStats.incrementFrustrating();
  }
  else {
    apdexStats.recordValueInMillis(duration);
  }
};

module.exports = Transaction;
