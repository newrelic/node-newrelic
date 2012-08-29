'use strict';

var path        = require('path')
  , Probe       = require(path.join(__dirname, 'probe'))
  , Timer       = require(path.join(__dirname, '..', 'timer'))
  , sumChildren = require(path.join(__dirname, '..', 'util', 'sum-children'))
  ;

/**
 * A Trace holds the root of the Probe graph and preoduces the final
 * serialization of the transaction trace.
 *
 * @param {Transaction} transaction The transaction bound to the trace.
 */
function Trace(transaction) {
  if (!transaction) throw new Error('All traces must be associated with a transaction.');

  this.transaction = transaction;

  this.root = new Probe(this, 'TRACE');
}

/**
 * End and close the current trace.
 */
Trace.prototype.end = function () {
  this.root.end();
};

/**
 * Add a child to the list of probes.
 *
 * @param {string} childName Name for the new probe.
 * @returns {Probe} Newly-created Probe.
 */
Trace.prototype.add = function (childName, callback) {
  return this.root.add(childName, callback);
};

/**
 * Explicitly set a trace's runtime instead of using it as a stopwatch.
 * (As a byproduct, stops the timer.)
 *
 * @param {int} duration Duration of this particular trace.
 * @param {int} startTimeInMillis (optional) Start of this trace.
 */
Trace.prototype.setDurationInMillis = function (duration, startTimeInMillis) {
  this.root.timer.setDurationInMillis(duration, startTimeInMillis);
};

/**
 * @return {integer} The amount of time the trace took, in milliseconds.
 */
Trace.prototype.getDurationInMillis = function () {
  return this.root.timer.getDurationInMillis();
};

/**
 * The duration of the transaction trace tree that only this level accounts
 * for.
 *
 * @return {integer} The amount of time the trace took, minus any child
 *                   traces, in milliseconds.
 */
Trace.prototype.getExclusiveDurationInMillis = function () {
  var total = this.getDurationInMillis();

  if (this.root.children.length > 0) {
    // convert the list of start, duration pairs to start, end pairs
    var timePairs = this.root.children.map(function (probe) {
      return probe.timer.toRange();
    });

    total -= sumChildren(timePairs);
  }

  return total;
};

/**
 * @return {Timer} The timer, in case we need to explicitly set the trace duration.
 */
Trace.prototype.getTimer = function () {
  return this.timer;
};

/**
 * @return {string} The name of the metric being tracked by this trace.
 */
Trace.prototype.getMetric = function () {
  return this.metric.name;
};

/**
 * @return {string} The (optional) scope for the metric being tracked by this trace.
 */
Trace.prototype.getScope = function () {
  return this.metric.scope;
};

module.exports = Trace;
