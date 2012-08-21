'use strict';

var path        = require('path')
  , Metric      = require(path.join(__dirname, 'trace', 'metric'))
  , Timer       = require(path.join(__dirname, 'timer'))
  , sumChildren = require(path.join(__dirname, 'util', 'sum-children'))
  ;

/**
 * A trace is a metric plus a timing.
 *
 * The minimal set of data to represent an individual trace. Starts counting
 * the time elapsed at instantiation. Traces can't be reopened once ended.
 *
 * @param {string} name The name of the metric which this trace is tracking.
 * @param {string} scope The name of the context to which this trace is scoped.
 */
function Trace(name, scope) {
  this.name = name;
  this.scope = scope;

  this.children = [];
  this.metric = new Metric(name, scope);

  this.timer = new Timer();
  this.timer.begin();
}

/**
 * End and close the current trace.
 */
Trace.prototype.end = function () {
  this.timer.end();
};

/**
 * Separate the execution time for child tasks from the current level of the transaction.
 *
 * Inherits the current scope, if specified.
 *
 * @param {string} childName Dependent metric name.
 * @return {Trace} The child tracer.
 */
Trace.prototype.addChild = function (childName) {
  var childTracer = new Trace(childName, this.scope);

  this.children.push(childTracer);
  return childTracer;
};

/**
 * Explicitly set a trace's runtime instead of using it as a stopwatch.
 * (As a byproduct, stops the timer.)
 *
 * @param {int} duration Duration of this particular trace.
 * @param {int} startTimeInMillis (optional) Start of this trace.
 */
Trace.prototype.setDurationInMillis = function (duration, startTimeInMillis) {
  this.timer.setDurationInMillis(duration);

  if (startTimeInMillis > 0) {
    this.timer.start = startTimeInMillis;
  }
};

/**
 * @return {integer} The amount of time the trace took, in milliseconds.
 */
Trace.prototype.getDurationInMillis = function () {
  return this.timer.getDurationInMillis();
};

/**
 * The duration of the transaction trace tree that only this level accounts
 * for.
 *
 * @return {integer} The amount of time the trace took, minus any child
 *                   traces, in milliseconds.
 */
Trace.prototype.getExclusiveDurationInMillis = function () {
  var total = this.timer.getDurationInMillis();

  if (this.children.length > 0) {
    // convert the list of start, duration pairs to start, end pairs
    var timePairs = this.children.map(function (trace) {
      return [trace.getTimer().start,
              trace.getTimer().start + trace.getDurationInMillis()];
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
