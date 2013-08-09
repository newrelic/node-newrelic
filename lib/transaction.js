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

  this.id = id++;
  this.pendingReporters = 1;
  this.exceptions = [];

  this.timer = new Timer();
  this.timer.begin();

  this.agent      = agent;
  this.normalizer = agent.normalizer;
  this.metrics    = new Metrics(agent.apdexT, agent.renamer, agent.normalizer);
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

  this.reportFinished();
};

/**
 * @return {bool} Is this transaction still alive?
 */
Transaction.prototype.isActive = function () {
  return this.timer.isActive();
};

/**
 * Allow a segment's callbacks to defer the delivery of a transaction's metrics
 * to the agent until all its own metrics have been added to the transaction.
 * Could be done with events, but simple reference-counting is good enough for
 * now and minimizes the amount of asynchronous behavior to track.
 */
Transaction.prototype.addReporter = function () {
  this.pendingReporters += 1;
};

/**
 * If both the transaction and observers have finished adding their metrics,
 * go ahead and pass the metrics back to the agent for merging.
 */
Transaction.prototype.reportFinished = function () {
  this.pendingReporters -= 1;
  if (this.pendingReporters < 1) {
    this.agent.emit('transactionFinished', this);
  }
};

/**
 * Open a new trace.
 *
 * @param {string} name The name of the metric to gather.
 * @param {string} scope (optional) Scope to which the metric is bound.
 */
Transaction.prototype.measure = function (name, scope, duration, exclusiveDuration) {
  return this.metrics.measureMilliseconds(name, scope, duration, exclusiveDuration);
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
    , apdexStats  = this.metrics.getOrCreateApdexMetric(name).stats
    ;

  if (isError && !errorTracer.ignoreStatusCode(statusCode)) {
    apdexStats.incrementFrustrating();
  }
  else {
    apdexStats.recordValueInMillis(duration);
  }
};

module.exports = Transaction;
