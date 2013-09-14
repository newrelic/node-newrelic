'use strict';

var path    = require('path')
  , util    = require('util')
  , web     = require(path.join(__dirname, 'transaction', 'web.js'))
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
  this.metrics = new Metrics(agent.apdexT, agent.mapper);

  this.id = id++;
  this.exceptions = [];
  this.timer = new Timer();
  this.timer.begin();

  // hidden class optimization
  this.ignore     = false;
  this.trace      = null;
  this.url        = null;
  this.scope      = null;
  this.statusCode = null;
  this.verb       = null;
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
 * Assign a scope for this transaction, which can mark the transaction as
 * ignored. Should run as late in the transaction's lifetime as possible.
 *
 * If the transaction is ignored, don't bother with the other stuff to save
 * resources.
 *
 * Works entirely via side effects.
 *
 * @param {TraceSegment} segment The segment measuring the overall request.
 * @param {string}       requestURL The URL to extract the name from.
 * @param {string}       statusCode The HTTP status code from the response.
 */
Transaction.prototype.setScope = function (segment, requestURL, statusCode) {
  var path        = web.scrubURL(requestURL)
    , partialName
    ;

  if (web.isError(statusCode)) {
    // we've got an error transaction
    partialName = NAMES.STATUS + statusCode;
  }
  else if (this.scope) {
    // the API has already been used to set the scope explicitly
    partialName = this.scope;
  }
  else {
    partialName = this.agent.normalizer.normalize(path);
  }

  if (partialName) {
    var scope  = NAMES.WEB + '/' + partialName
      , params = web.getParametersFromURL(requestURL)
      ;

    this.url = path;
    this.statusCode = statusCode;

    // transaction scope and web segment name must match
    this.scope = scope;
    segment.name = scope;
    // partialName is used to name apdex metrics when recording
    segment.partialName = partialName;

    // don't replace any existing segment or trace parameters
    util._extend(segment.parameters, params);
    util._extend(segment.trace.parameters, params);
  }
  else {
    this.ignore = true;
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
 */
Transaction.prototype._setApdex = function (name, duration) {
  var statusCode  = this.statusCode
    , errorTracer = this.agent.errors
    , isError     = statusCode < 200 || statusCode >= 400
    , apdexStats  = this.metrics.getOrCreateApdexMetric(name)
    ;

  if (isError && !errorTracer.ignoreStatusCode(statusCode)) {
    apdexStats.incrementFrustrating();
  }
  else {
    apdexStats.recordValueInMillis(duration);
  }
};

module.exports = Transaction;
