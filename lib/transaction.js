"use strict";

/**
 * Given a set of metric traces, produce a statistical summary.
 *
 * @param {Array} traces The set of durations to summarize.
 */
function MetricSummary(traces) {
  var calls                  =  traces.length
    , totalInMillis          =  0
    , totalExclusiveInMillis =  0
    , min                    =  0
    , max                    =  0
    , sumOfSquares           =  0
    ;

  var durations = traces.map(function (trace) {
    return trace.getDurationInMillis();
  });

  // '0' is the conventional scope to use when hijacking Math methods.
  min = Math.min.apply(0, durations);
  max = Math.max.apply(0, durations);

  durations.forEach(function (duration) {
    totalInMillis          += duration;
    // FIXME: here for compatibility with existing implementation, but
    //        not sure "child" duration is a concept that makes sense
    //        in a evented context
    totalExclusiveInMillis += duration;
    sumOfSquares           += duration * duration;
  });

  /**
   * Produce a readable / explorable representation of the summary.
   *
   * @returns {Object} literal dictionary representation of the statistics.
   */
  this.toObject = function () {
    return {
      calls                  : calls,
      totalInMillis          : totalInMillis,
      totalExclusiveInMillis : totalExclusiveInMillis,
      min                    : min,
      max                    : max,
      sumOfSquares           : sumOfSquares
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
  this.toJSON = function () {
    return [
      calls,
      totalInMillis,
      totalExclusiveInMillis,
      min,
      max,
      sumOfSquares
    ];
  };
}

/**
 * The minimal set of data to represent an individual trace. Starts counting
 * the time elapsed at instantiation. Traces can't be reopened once ended.
 */
function Trace() {
  var active = true
    , finish
    ;

  // we need a start date and a duration to reconstruct the timeline
  this.start = Date.now();

  /**
   * End and close the current trace.
   */
  this.end = function () {
    if (!active) return;

    finish = Date.now();
    active = false;
  };

  /**
   * @return {integer} The amount of time the trace took, in milliseconds.
   */
  this.getDurationInMillis = function () {
    return finish - this.start;
  };
}

/**
 * Explicit enumeration of the states a transaction can be in:
 *
 * TRANSACTION_PENDING upon instantiation (implicitly, no start time set)
 * TRANSACTION_RUNNING while transaction is running (implicitly, start time is
 *   set but no stop time is set).
 * TRANSACTION_STOPPED transaction has been completeted (implicitly, start time
 *   and stop time are set, but the transaction has not yet been harvested)
 *
 * FIXME: determine whether it's necessary to have a specific state-tracking
 * variable at all.
 */
var TRANSACTION_PENDING = 1
  , TRANSACTION_RUNNING = 2
  , TRANSACTION_STOPPED = 3
  , TRANSACTION_DEAD    = 4
  ;

/**
 * One full transaction trace, scoped to a particular application.
 *
 * @param {Object} application Presumably either the agent, or one application defined on an agent.
 */
function Transaction(application) {
  var state    = TRANSACTION_PENDING
    , scoped   = {}
    , unscoped = {}
    , start
    , finish
    ;

  if (!application) throw new Error('every transaction must be scoped to an application');

  /**
   * The scope to which the current transaction is bound.
   */
  this.application = application;

  start = Date.now();
  state = TRANSACTION_RUNNING;

  /**
   * Close out the current transaction, recursively ending any still-open
   * traces on the transaction (FIXME: when better asynchronous support is
   * available in core, not necessary to hard-stop the transaction, although
   * it makes it tough to know when to harvest the transaction).
   */
  this.end = function () {
    if (state > TRANSACTION_RUNNING) return;

    Object.keys(unscoped).forEach(function (key) {
      unscoped[key].forEach(function (trace) {
        trace.end();
      });
    });

    finish = Date.now();
    state = TRANSACTION_STOPPED;
  };

  /**
   * @return {bool} Is this transaction still alive?
   */
  this.isActive = function () {
    return state < TRANSACTION_STOPPED;
  };

  /**
   * Open a new trace.
   *
   * @param {string} name The name of the metric to gather.
   * @param {string} scope (optional) Scope to which the metric is bound.
   */
  this.measure = function (name, scope) {
    // throwing is unsafe in asynchronous contexts, so silently return
    if (state > TRANSACTION_RUNNING) return;

    var trace = new Trace();

    var resolved;
    // if given a scope, ensure there's an object to store its trace in
    if (scope) {
       if (!scoped[scope]) scoped[scope] = {};

       resolved = scoped[scope];
    }
    else {
      resolved = unscoped;
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
  this.getMetrics = function (name, scope) {
    if (scope) {
      return scoped[scope][name];
    }
    else {
      return unscoped[name];
    }
  };

  /**
   * Generate summary statistics for the traces associated with a metric.
   * If called with no parameters, summarize all traces associated with
   * the transaction.
   *
   * @param {string} name (optional) The name of the metric.
   * @param {string} scope (optional) Scope to which the metric is bound.
   * @returns {Object} Either a MetricSummary for a single metric, or an
   *                   object graph of metric -> summary / scope ->
   *                   metric -> summary paths.
   */
  this.getStatistics = function (name, scope) {
    if (!(name || scope)) {
      return this.summarize();
    }
    else {
      return new MetricSummary(this.getMetrics(name, scope));
    }
  };

  /**
   * Generate a summary of the transaction. Will work if the transaction
   * is still open, but I wouldn't use the results for anything except
   * debugging.
   *
   * @returns {Object} Object graph of metric -> summary / scope ->
   *                   metric -> summary paths.
   */
  this.summarize = function () {
    var self = this;

    var summary = {
      scoped : [],
      unscoped : []
    };

    Object.keys(scoped).forEach(function (scope, i, a) {
      var names = {};
      Object.keys(scoped[scope]).forEach(function (name, i, a) {
        names[name] = new MetricSummary(self.getMetrics(name, scope));
      });
      summary.scoped[scope] = names;
    });

    Object.keys(unscoped).forEach(function (name, i, a) {
      summary.unscoped[name] = new MetricSummary(self.getMetrics(name));
    });

    return summary;
  };
}

// one single transaction manager per process, hence the need to scope the
// transactions to an agent or application
var transactions = {};

/**
 * Create a new transaction.
 *
 * @param {Object} application Presumably either the agent, or one
 *                             application defined on an agent.
 * @returns {Transaction} Ready-to-use transaction (with its own (currently
 *                        unused) timer).
 */
exports.create = function (application) {
  var blank = new Transaction(application);

  if (!transactions[application.name]) transactions[application.name] = [];
  transactions[application.name].push(blank);

  return blank;
};

/**
 * Used for testing. Nuke the internal transaction list.
 */
exports.reset = function () {
  Object.keys(transactions).forEach(function (key) {
    transactions[key].forEach(function (transaction, index) { transaction.end(); });
  });
  transactions = {};
};

/**
 * Fetch the list of transactions scoped to the application.
 *
 * @param {Object} application Presumably either the agent, or one
 *                             application defined on an agent.
 * @returns {Array} List of transactions associated with an application.
 */
exports.getByApplication = function (application) {
  return transactions[application.name];
};

/**
 * Fetch the list of active transactions scoped to the application. Useful
 * for debugging, probably not so useful for production use.
 *
 * @param {Object} application Presumably either the agent, or one
 *                             application defined on an agent.
 * @returns {Array} List of active transactions associated with an application.
 */
exports.getActiveByApplication = function (application) {
  return transactions[application.name].filter(function (transaction) {
    return transaction.isActive();
  });
};
