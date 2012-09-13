'use strict';

var path         = require('path')
  , util         = require('util')
  , EventEmitter = require('events').EventEmitter
  , logger       = require(path.join(__dirname, '..', '..', 'logger'))
  ;

/**
 * Locus for the complicated logic surrounding the selection of slow
 * transaction traces for submission to the collector.
 *
 * @param {object} config Dictionary containing transaction tracing
 *                        parameters. Required.
 */
function TraceAggregator (config) {
  EventEmitter.call(this);

  if (!config) throw new Error("Trace aggregator needs configuration at startup.");

  /*
   * From
   * https://newrelic.atlassian.net/wiki/display/eng/Transaction+Trace+Collection+Improvements
   *
   * 5 Transaction Trace Guarantee
   *
   * For the initial experience problem, the Agent will sample up to 1
   * transaction per minute until it has sampled 5 transactions. This
   * guarantees that the agent will always report some transaction traces.
   * There is no time out for this sampling period - the agent always
   * samples until it has collected 5 transactions. The agent doesn't
   * simply report the first 5 transactions that it sees because it's
   * likely (particularly for a local dev test) that all 5 transactions
   * would be associated with one request (a single web page and its
   * resources).
   */
  this.reported = 0;
  this.config   = config.transaction_tracer || {};
  this.capacity = this.config.top_n ? this.config.top_n : 1;
  this.resetTimingTracker();
}
util.inherits(TraceAggregator, EventEmitter);

/**
 * For every five harvest cycles (or "minutes"), if no new slow transactions
 * have been added, reset the requestTime match and allow a new set of five
 * to start populating the Top N Slow Trace list.
 */
TraceAggregator.prototype.resetTimingTracker = function resetTT() {
  this.requestTimes     = {};
  this.noTraceSubmitted = 0;
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

    if (this.isBetter(scope, duration, apdexT)) {
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
    // calls out to zlib are asynchronous
    trace.generateJSON(function encodeTrace(err, encoded) {
      if (err) return logger.warn("Unable to generate trace JSON:", err);

      self.reported += 1;
      self.emit('harvest', encoded);
    });
  }
  else {
    this.noTraceSubmitted += 1;
    if (this.noTraceSubmitted >= 5) this.resetTimingTracker();

    // The tests, at least, need an event, regardless of whether there's a
    // payload.
    this.emit('harvest');
  }
};

/**
 * Determine whether a new trace is more worth keeping than an old one.
 * This gets called on every single transactionFinished event, so return as
 * quickly as possible and call as few external functions as possible. On the
 * converse, there's some complicated logic here, so spell things out.
 *
 * All specifications are from
 * https://newrelic.atlassian.net/wiki/display/eng/Transaction+Trace+Collection+Improvements
 *
 * @param {string} scope    Name of this transaction's key metric.
 * @param {number} duration Time the transaction took, in milliseconds.
 * @param {number} apdexT   Apdex tolerating threshold, in seconds.
 */
TraceAggregator.prototype.isBetter = function isBetter(scope, duration, apdexT) {
  /*
   * 1. If the transaction duration is below the tracing threshold, the
   *    transaction is skipped.
   *
   * The threshold for slow transactions is 4 * apdexT.
   */
  var isOverThreshold = duration > 4 * 1000 * apdexT;
  if (!isOverThreshold) return false;

  /*
   * 2. If the transaction duration is less than the duration of the current
   *    slow transaction, the transaction is skipped.
   */
  var slowerThanExisting = true;
  if (this.trace) {
    slowerThanExisting = this.trace.getDurationInMillis() < duration;
  }
  if (!slowerThanExisting) return false;

  /*
   * 3. If the transaction's name is in the transaction map and its duration
   *    is less than the response time in the map, it is skipped.
   */
  var hasMetGuarantee = this.reported >= 5;
  if (hasMetGuarantee) {
    var slowerThanCaptured = true;
    if (this.requestTimes[scope]) {
      slowerThanCaptured = this.requestTimes[scope] < duration;
    }

    return slowerThanCaptured;
  }

  /*
   * 4. The transaction is held as the slowest transaction.
   */
  return true;
};

module.exports = TraceAggregator;
