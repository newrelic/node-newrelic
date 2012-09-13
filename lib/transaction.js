'use strict';

var path      = require('path')
  , callstack = require(path.join(__dirname, 'util', 'callstack'))
  , Metrics   = require(path.join(__dirname, 'metrics'))
  , Timer     = require(path.join(__dirname, 'timer'))
  , Trace     = require(path.join(__dirname, 'transaction', 'trace'))
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

  this.timer = new Timer();
  this.timer.begin();

  this.agent = agent;

  var apdexT     = (agent.metrics) ? agent.metrics.apdexT : 0;
  var renamer    = (agent.metrics) ? agent.metrics.renamer : null;
  var normalizer = (agent.metrics) ? agent.metrics.normalizer : null;
  this.metrics   = new Metrics(apdexT, renamer, normalizer);
}

/**
 * Associate a transaction with a URL and mark it as a web transaction.
 *
 * @param {string} url The URL for this transaction.
 */
Transaction.prototype.setURL = function (url) {
  this.url = url;
};

/**
 * Associate a transaction with a scope.
 *
 * @param {string} scope The scope for this transaction.
 */
Transaction.prototype.setScope = function (scope) {
  this.scope = scope;
};

/**
 * Associate a transaction with a status code.
 *
 * @param {string} statusCode The HTTP status code for this transaction.
 */
Transaction.prototype.setStatusCode = function (statusCode) {
  this.statusCode = statusCode;
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
  if (this.callSites) callstack.clearAnnotations(this, this.callSites);

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
 * Add functionality to more or less manually garbage-collect transactions from
 * call stacks when transactions are done.
 */
Transaction.prototype.addCallSite = function (funktion) {
  if (!this.callSites) this.callSites = [];
  this.callSites.push(funktion);
};

/**
 * Open a new trace.
 *
 * @param {string} name The name of the metric to gather.
 * @param {string} scope (optional) Scope to which the metric is bound.
 */
Transaction.prototype.measure = function (name, scope, duration, exclusiveDuration) {
  // throwing is unsafe in asynchronous contexts, so silently return
  if (!this.timer.isActive()) return;

  var metric = this.metrics.getOrCreateMetric(name, scope);
  metric.stats.recordValueInMillis(duration, exclusiveDuration);

  return metric;
};

Transaction.prototype.measureWeb = function (requestURL, statusCode, duration, exclusiveDuration) {
  var isError = statusCode < 200 || statusCode >= 400;

  this.setURL(requestURL);
  this.setStatusCode(statusCode);

  if (this.trace && (duration || duration === 0)) this.trace.setDurationInMillis(duration);

  // FIXME: strip query string / params

  var partialName;
  if (statusCode === 414 || // Request-URI Too Long
      (statusCode >= 400 && statusCode < 405)) {
    partialName = 'StatusCode/' + statusCode;
  }
  else {
    if (requestURL === '/') {
      requestURL = '/ROOT';
    }
    else if (requestURL.charAt(requestURL.length - 1) === '/') {
      requestURL = requestURL.substring(0, requestURL.length - 1);
    }

    var normalizedUrl = this.metrics.normalizer.normalizeUrl(requestURL);
    if (normalizedUrl) {
      partialName = 'NormalizedUri' + normalizedUrl;
    }
    else {
      partialName = 'Uri' + requestURL;
    }
  }

  var metrics = this.metrics;
  metrics.measureDurationUnscoped('WebTransaction', duration);
  metrics.measureDurationUnscoped('HttpDispatcher', duration);

  this.setScope("WebTransaction/" + partialName);
  // var maxDuration = Math.max(0, duration - this.totalExclusive);
  var maxDuration = Math.max(0, exclusiveDuration);
  metrics.measureDurationUnscoped(this.scope, duration, maxDuration);

  ['Apdex/' + partialName, 'Apdex'].forEach(function (name) {
    var apdexStats = metrics.getOrCreateApdexMetric(name).stats;
    if (isError) {
      apdexStats.incrementFrustrating();
    }
    else {
      apdexStats.recordValueInMillis(duration);
    }
  });

  return this.scope;
};

/**
 * Look up metrics for a transaction.
 *
 * @param {string} name The name of the metric.
 * @param {string} scope (optional) Scope to which the metric is bound.
 * @returns {Array} Relevant metric.
 */
Transaction.prototype.getMetrics = function (name, scope) {
  return this.metrics.getMetric(name, scope);
};

module.exports = Transaction;
