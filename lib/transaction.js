'use strict';

var path    = require('path')
  , Metrics = require(path.join(__dirname, 'metrics'))
  , Timer   = require(path.join(__dirname, 'timer'))
  , Trace   = require(path.join(__dirname, 'transaction', 'trace'))
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
  this.trace      = null;
  this.url        = null;
  this.scope      = null;
  this.statusCode = null;
}

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
 * Set all of the properties specific to transactions associated with
 * web requests. Typically set at the end of the request, and needs to
 * happen before measurements that depend on the scope / transaction name
 * are recorded.
 *
 * @param {string} path The URL fragment denoting the path of the request.
 * @param {string} scope The name of this transaction, which is the scope
 *                       to which all scoped transactions will be bound.
 * @param {string} code The HTTP status code for this request.
 */
Transaction.prototype.setWeb = function (path, scope, code) {
  this.url        = path;
  this.scope      = scope;
  this.statusCode = code;
};

/**
 * Return the associated transaction trace, creating it if necessary.
 */
Transaction.prototype.getTrace = function () {
  if (!this.trace) this.trace = new Trace(this);

  return this.trace;
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
 * @return {bool} Is this transaction still alive?
 */
Transaction.prototype.isActive = function () {
  return this.timer.isActive();
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
