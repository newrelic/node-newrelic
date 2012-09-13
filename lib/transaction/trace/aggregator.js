'use strict';

var path         = require('path')
  , util         = require('util')
  , EventEmitter = require('events').EventEmitter
  , logger       = require(path.join(__dirname, '..', '..', 'logger'))
  ;

function isOverThreshold(duration, apdexT) {
  return duration > 4 * 1000 * apdexT;
}

function TraceAggregator (config) {
  EventEmitter.call(this);

  if (!config) throw new Error("Trace aggregator needs configuration at startup.");

  this.config   = config.transaction_tracer || {};
  this.capacity = this.config.top_n ? this.config.top_n : 1;
  this.reported = 0;
  this.resetTimingTracker();
}
util.inherits(TraceAggregator, EventEmitter);

TraceAggregator.prototype.resetTimingTracker = function resetTT() {
  this.requestTimes     = {};
  this.noTraceSubmitted = 0;
};

TraceAggregator.prototype.isBetter = function isBetter(scope, duration) {
  var slowerThanExisting = true;
  if (this.trace) {
    slowerThanExisting = this.trace.getDurationInMillis() < duration;
  }

  if (this.reported >= 5) {
    var slowerThanCaptured = true;
    if (this.requestTimes[scope]) {
      slowerThanCaptured = this.requestTimes[scope] < duration;
    }

    return slowerThanExisting && slowerThanCaptured;
  }
  else {
    return slowerThanExisting;
  }
};

/**
 * Add a trace to the slow trace list, if and only if it fulfills the necessary
 * criteria.
 *
 * @param {Transaction} transaction The transaction, which we need to check
 *                                  apdexT, as well as getting the trace.
 */
TraceAggregator.prototype.add = function add(transaction) {
  if (transaction && transaction.metrics) {
    var trace    = transaction.getTrace()
      , scope    = transaction.scope
      , duration = trace.getDurationInMillis()
      , apdexT   = transaction.metrics.apdexT
      ;

    if (isOverThreshold(duration, apdexT) && this.isBetter(scope, duration)) {
      this.trace = trace;

      // because of the "first 5" rule, this may or may not be the slowest
      if (!this.requestTimes[scope] || this.requestTimes[scope] < duration) {
        this.requestTimes[scope] = duration;
      }
    }
  }
};

/**
 * Triggers a harvest cycle, which emits a set of captured transaction traces
 * and does any necessary internal state cleansing.
 *
 * Emits 'harvest' event when finished, optionally with an encoded trace.
 */
TraceAggregator.prototype.harvest = function harvest() {
  var trace = this.trace;
  delete this.trace;

  var self = this;
  if (trace) {
    trace.generateJSON(function encodeTrace(err, encoded) {
      if (err) return logger.warn("Unable to generate trace JSON:", err);

      self.reported += 1;
      self.emit('harvest', encoded);
    });
  }
  else {
    this.noTraceSubmitted += 1;
    if (this.noTraceSubmitted >= 5) this.resetTimingTracker();

    this.emit('harvest');
  }
};

module.exports = TraceAggregator;
