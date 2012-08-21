'use strict';

var path          = require('path')
  , Metrics       = require(path.join(__dirname, '..', 'metric', 'metrics'))
  , Trace         = require(path.join(__dirname, '..', 'trace-nu'))
  , Timer         = require(path.join(__dirname, '..', 'timer'))
  ;

/**
 * One full transaction trace, scoped to a particular application.
 *
 * @param {Object} application Presumably either the agent, or one application defined on an agent.
 */
function Transaction(agent) {
  if (!agent) throw new Error('every transaction must be bound to the agent');

  this.timer = new Timer();
  this.timer.begin();

  this.agent = agent;
  var apdexT = (agent && agent.metrics) ? agent.metrics.apdexT : 0;
  this.metrics = new Metrics(null, apdexT);
  this.scoped   = {};
  this.unscoped = {};
}

/**
 * Close out the current transaction, recursively ending any still-open
 * traces on the transaction (FIXME: when better asynchronous support is
 * available in core, not necessary to hard-stop the transaction, although
 * it makes it tough to know when to harvest the transaction).
 */
Transaction.prototype.end = function () {
  if (!this.timer.isActive()) return;

  this.timer.end();

  var self = this;
  Object.keys(this.unscoped).forEach(function (key) {
    self.unscoped[key].forEach(function (trace) {
      trace.end();
    });
  });
};

/**
 * @return {bool} Is this transaction still alive?
 */
Transaction.prototype.isActive = function () {
  return this.timer.isActive();
};

/**
 * Open a new trace.
 *
 * @param {string} name The name of the metric to gather.
 * @param {string} scope (optional) Scope to which the metric is bound.
 */
Transaction.prototype.measure = function (name, scope) {
  // throwing is unsafe in asynchronous contexts, so silently return
  if (!this.timer.isActive()) return;

  var trace = new Trace(name, scope);

  // if given a scope, ensure there's an object to store its trace in
  var resolved;
  if (scope) {
    if (!this.scoped[scope]) this.scoped[scope] = {};

    resolved = this.scoped[scope];
  }
  else {
    resolved = this.unscoped;
  }

  // ensure there's a home for the trace
  if (!resolved[name]) resolved[name] = [];

  resolved[name].push(trace);

  return trace;
};

/**
 * Retrieve all of the traces associated with a metric.
 *
 * @param {string} name The name of the metric.
 * @param {string} scope (optional) Scope to which the metric is bound.
 * @returns {Array} Set of traces (not necessarily closed).
 */
Transaction.prototype.getMetrics = function (name, scope) {
  if (scope) {
    return this.scoped[scope][name];
  }
  else {
    return this.unscoped[name];
  }
};

module.exports = Transaction;
