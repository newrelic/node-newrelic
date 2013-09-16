'use strict';

var path         = require('path')
  , util         = require('util')
  , EventEmitter = require('events').EventEmitter
  , logger       = require(path.join(__dirname, '..', '..', 'logger'))
                     .child({component : 'trace_aggregator'})
  ;

/*
 *
 * CONSTANTS
 *
 */
var TO_MILLIS = 1000;

/**
 * Locus for the complicated logic surrounding the selection of slow
 * transaction traces for submission to the collector.
 *
 * @param {object} config Dictionary containing transaction tracing
 *                        parameters. Required.
 */
function TraceAggregator(config) {
  EventEmitter.call(this);

  if (!config) throw new Error("Trace aggregator needs configuration at creation.");

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
  this.config   = config;

  // Setting up top n capacity.
  this.capacity = 1;
  if (config.transaction_tracer &&
      config.transaction_tracer.top_n) {
    this.capacity = config.transaction_tracer.top_n;
  }

  // hidden class optimization
  this.trace            = null;
  this.requestTimes     = {};
  this.noTraceSubmitted = 0;
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
  if (this.config.collect_traces &&
      this.config.transaction_tracer && this.config.transaction_tracer.enabled &&
      transaction && transaction.metrics && !transaction.ignore) {
    var trace    = transaction.getTrace()
      , name     = transaction.name
      , duration = trace.getDurationInMillis()
      , apdexT   = transaction.metrics.apdexT
      ;

    if (this.isBetter(name, duration, apdexT)) {
      this.trace = trace;

      // because of the "first 5" rule, this may or may not be the slowest
      if (!this.requestTimes[name] || this.requestTimes[name] < duration) {
        this.requestTimes[name] = duration;
      }
    }

    this.config.measureInternal('Transaction/Count', duration);
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
  this.trace = null;

  if (trace) {
    this.noTraceSubmitted = 0;

    // calls out to zlib are asynchronous
    trace.generateJSON(function encodeTrace(err, encoded) {
      if (err) return logger.warn(err, "Unable to generate trace JSON.");

      this.reported += 1;
      this.emit('harvest', encoded);
    }.bind(this));
  }
  else {
    this.noTraceSubmitted += 1;
    if (this.noTraceSubmitted >= 5) this.resetTimingTracker();

    /* The tests, at least, need an event, regardless of whether there's a
     * payload.
     */
    process.nextTick(function () { this.emit('harvest'); }.bind(this));
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
 * @param {string} name     Name of this transaction's key metric.
 * @param {number} duration Time the transaction took, in milliseconds.
 * @param {number} apdexT   Apdex tolerating threshold, in seconds.
 */
TraceAggregator.prototype.isBetter = function isBetter(name, duration, apdexT) {
  /* 1. If the transaction duration is below the tracing threshold, the
   *    transaction is skipped.
   *
   * The threshold for slow traces defaults to apdex_f, which is 4 * apdex_t.
   */
  var config = this.config.transaction_tracer
    , isOverThreshold
    ;
  if (config &&
      config.transaction_threshold &&
      config.transaction_threshold !== 'apdex_f' &&
      typeof config.transaction_threshold === 'number') {
    isOverThreshold = duration > config.transaction_threshold * TO_MILLIS;
  }
  else {
    isOverThreshold = duration > 4 * TO_MILLIS * apdexT;
  }
  if (!isOverThreshold) return false;

  /* 2. If the transaction duration is less than the duration of the current
   *    slow transaction, the transaction is skipped.
   */
  var slowerThanExisting = true;
  if (this.trace) {
    slowerThanExisting = this.trace.getDurationInMillis() < duration;
  }
  if (!slowerThanExisting) return false;

  /* We always gather some slow transactions at the start, regardless of
   * the size of Top N. This changes the behavior of the rest of the
   * decision-making process in some subtle ways.
   */
  var hasMetGuarantee = this.reported >= 5;

  /* 3. If the transaction's name is in the transaction map and its duration
   *    is less than the response time in the map, it is skipped.
   */
  var slowerThanCaptured = true;
  if (hasMetGuarantee) {
    if (this.requestTimes[name]) {
      slowerThanCaptured = this.requestTimes[name] < duration;
    }
  }
  if (!slowerThanCaptured) return false;

  /* Not part of enumerated rules, but necessary for Top N support:
   * Ensure this name is either already in the request time map
   * or that the map still hasn't hit capacity.
   */
  if (hasMetGuarantee &&
      !this.requestTimes[name] &&
      Object.keys(this.requestTimes).length >= this.capacity) {
    return false;
  }

  /* 4. The transaction is held as the slowest transaction.
   */
  return true;
};

module.exports = TraceAggregator;
