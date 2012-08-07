'use strict';

/**
 * Given a set of metric traces, produce a statistical summary.
 *
 * @param {Array} traces The set of durations to summarize.
 */
function MetricSummary(traces) {
  this.calls                  = traces.length;
  this.totalInMillis          = 0;
  this.totalExclusiveInMillis = 0;
  this.min                    = 0;
  this.max                    = 0;
  this.sumOfSquares           = 0;

  var self = this;

  traces.forEach(function (trace) {
    self.totalExclusiveInMillis += trace.getExclusiveDurationInMillis();
  });

  var durations = traces.map(function (trace) {
    return trace.getDurationInMillis();
  });

  // '0' is the conventional scope to use when hijacking Math methods.
  this.min = Math.min.apply(0, durations);
  this.max = Math.max.apply(0, durations);

  durations.forEach(function (duration) {
    self.totalInMillis += duration;
    self.sumOfSquares  += duration * duration;
  });
}

/**
 * Produce a readable / explorable representation of the summary.
 *
 * @returns {Object} literal dictionary representation of the statistics.
 */
MetricSummary.prototype.toObject = function () {
  return {
    calls                  : this.calls,
    totalInMillis          : this.totalInMillis,
    totalExclusiveInMillis : this.totalExclusiveInMillis,
    min                    : this.min,
    max                    : this.max,
    sumOfSquares           : this.sumOfSquares
  };
};

/**
 * Produce a readily serializable representation of the summary.
 *
 * @returns {Array} An array containing, in order, the number of calls, the
 *                  total duration of the set of traces, the "exclusive"
 *                  time (not accurate yet), the fastest trace time,
 *                  the slowest trace time, and the running sum of squares
 *                  for the set (for calculating standard deviation).
 */
MetricSummary.prototype.toJSON = function () {
  return [
    this.calls,
    this.totalInMillis,
    this.totalExclusiveInMillis,
    this.min,
    this.max,
    this.sumOfSquares
  ];
};

module.exports = MetricSummary;
