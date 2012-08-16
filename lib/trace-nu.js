'use strict';

var path          = require('path')
  , Metric        = require(path.join(__dirname, 'trace', 'metric'))
  , Timer         = require(path.join(__dirname, 'timer'))
  ;

/**
 * Given an ordered list of disjoint intervals and a new interval to fold
 * into it, determine if the new interval is a sub-interval (in which case it's
 * redundant), an overlapping interval (in which case, replace the most
 * recent interval on the list with an interval representing the union of the
 * new and last intervals), or otherwise (it's disjoint to what we already
 * have, in which case add it to the list). Meant to be used with
 * Array.reduce().
 *
 * Assumes the list being reduced is sorted.
 *
 * @param {Array} accum The accumulated list of reduced intervals.
 * @param {Array} newest A new pair of range start and end to compare to the existing intervals.
 * @return {Array} A list of intervals updated to include the new interval.
 */
function reduceIntervals(accum, newest) {
  if (accum && accum.length > 0) {
    // the last interval on the list will always be the latest
    var last = accum.slice(-1)[0];

    // case 1: the new interval is a strict subset of the last interval
    if (newest[0] >= last[0] && newest[1] <= last[1]) {
      return accum;
    }
    // case 2: the start of the new interval is inside the last interval
    else if (newest[0] >= last[0] && newest[0] <= last[1]) {
      var heads = accum.slice(0, -1);
      // gotta double-wrap the array I'm appending onto the end
      return heads.concat([[last[0], newest[1]]]);
    }
    // case 3: the interval is disjoint
    else {
      return accum.concat([newest]);
    }
  }

  // base case: wrap up the newest element to create the accumulator
  return [newest];
}

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
    // 1. convert the list of start, duration pairs to start, end pairs
    var timePairs = this.children.map(function (trace) {
      return [trace.getTimer().start,
              trace.getTimer().start + trace.getDurationInMillis()];
    });

    // 2. sort the resulting list by start time
    var sortedPairs = timePairs.sort(function (a, b) { return a[0] - b[0]; });

    // 3. reduce the list to a set of disjoint intervals
    // I love ECMAscript 5!
    var disjointIntervals = sortedPairs.reduce(reduceIntervals, []);

    // 4. sum the durations of the intervals
    total -= disjointIntervals.reduce(function (accum, current) {
      return accum + (current[1] - current[0]);
    }, 0);
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
