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
 * A metric is a name, with an optional scope.
 *
 * @param {string} name The name of the metric, in path format.
 * @param {string} scope (optional) the scope to which this metric is bound
 */
function Metric(name, scope) {
   this.name = name;
   this.scope = scope;
}

/**
 * Explicit enumeration of the states a transaction can be in:
 *
 * PENDING upon instantiation (implicitly, no start time set)
 * RUNNING while transaction is running (implicitly, start time is
 *   set but no stop time is set).
 * STOPPED transaction has been completeted (implicitly, start time
 *   and stop time are set, but the transaction has not yet been harvested)
 *
 * FIXME: determine whether it's necessary to have a specific state-tracking
 * variable at all.
 */
var PENDING = 1
  , RUNNING = 2
  , STOPPED = 3
  , DEAD    = 4
  ;

/**
 * A mildly tricksy timer that tracks its own state and allows its duration
 * to be set manually.
 */
function Timer() {
  var state
    , finish
    , durationInMillis
    ;

  state = PENDING;

  this.begin = function () {
    if (state > PENDING) return;

    this.start = Date.now();
    state = RUNNING;
  };

  this.end = function () {
    if (state > RUNNING) return;

    finish = Date.now();
    state = STOPPED;
  };

  /**
   * @return {bool} Is this transaction still alive?
   */
  this.isActive = function () {
    return state < STOPPED;
  };

  this.setDurationInMillis = function (duration) {
    if (state > RUNNING) return;

    durationInMillis = duration;
    state = STOPPED;
  };

  this.getDurationInMillis = function () {
    if (durationInMillis) {
      return durationInMillis;
    }
    else {
      return finish - this.start;
    }
  };
}

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
      var heads = accum.slice(0,-1);
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
  var metric
    , timer
    , children = []
    ;

  metric = new Metric(name, scope);

  timer = new Timer();
  timer.begin();

  /**
   * End and close the current trace.
   */
  this.end = function () {
    timer.end();
  };

  /**
   * Separate the execution time for child tasks from the current level of the transaction.
   *
   * Inherits the current scope, if specified.
   *
   * @param {string} childName Dependent metric name.
   * @return {Trace} The child tracer.
   */
  this.addChild = function (childName) {
    var childTracer = new Trace(childName, scope);

    children.push(childTracer);
    return childTracer;
  };

  /**
   * Explicitly set a trace's runtime instead of using it as a stopwatch.
   * (As a byproduct, stops the timer.)
   *
   * @param {int} duration Duration of this particular trace.
   * @param {int} startTimeInMillis (optional) Start of this trace.
   */
  this.setDurationInMillis = function (duration, startTimeInMillis) {
    timer.setDurationInMillis(duration);

    if (startTimeInMillis > 0) {
      timer.start = startTimeInMillis;
    }
  };

  /**
   * @return {integer} The amount of time the trace took, in milliseconds.
   */
  this.getDurationInMillis = function () {
    return timer.getDurationInMillis();
  };

  /**
   * The duration of the transaction trace tree that only this level accounts
   * for.
   *
   * @return {integer} The amount of time the trace took, minus any child
   *                   traces, in milliseconds.
   */
  this.getExclusiveDurationInMillis = function () {
    var total = timer.getDurationInMillis();

    if (children.length > 0) {
      // 1. convert the list of start, duration pairs to start, end pairs
      var timePairs = children.map(function (trace) {
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
  this.getTimer = function () {
    return timer;
  };

  /**
   * @return {string} The name of the metric being tracked by this trace.
   */
  this.getMetric = function () {
    return metric.name;
  };

  /**
   * @return {string} The (optional) scope for the metric being tracked by this trace.
   */
  this.getScope = function () {
    return metric.scope;
  };
}

/**
 * One full transaction trace, scoped to a particular application.
 *
 * @param {Object} application Presumably either the agent, or one application defined on an agent.
 */
function Transaction(application) {
  var scoped   = {}
    , unscoped = {}
    , timer
    ;

  if (!application) throw new Error('every transaction must be scoped to an application');

  timer = new Timer();
  timer.begin();

  /**
   * The scope to which the current transaction is bound.
   */
  this.application = application;

  /**
   * Close out the current transaction, recursively ending any still-open
   * traces on the transaction (FIXME: when better asynchronous support is
   * available in core, not necessary to hard-stop the transaction, although
   * it makes it tough to know when to harvest the transaction).
   */
  this.end = function () {
    if (!timer.isActive()) return;

    Object.keys(unscoped).forEach(function (key) {
      unscoped[key].forEach(function (trace) {
        trace.end();
      });
    });

    timer.end();
  };

  /**
   * @return {bool} Is this transaction still alive?
   */
  this.isActive = function () {
    return timer.isActive();
  };

  /**
   * Open a new trace.
   *
   * @param {string} name The name of the metric to gather.
   * @param {string} scope (optional) Scope to which the metric is bound.
   */
  this.measure = function (name, scope) {
    // throwing is unsafe in asynchronous contexts, so silently return
    if (!timer.isActive()) return;

    var trace = new Trace(name, scope);

    // if given a scope, ensure there's an object to store its trace in
    var resolved;
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
