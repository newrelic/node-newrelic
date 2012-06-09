"use strict";

function MetricSummary(traces) {
  var calls                  =  traces.length
    , totalInMillis          =  0
    , totalExclusiveInMillis =  0
    , min                    =  0
    , max                    =  0
    , sumOfSquares           =  0
    ;

  var durations = traces.map(function (trace) {
    return trace.durationInMillis();
  });

  min = Math.min.apply(0, durations);
  max = Math.max.apply(0, durations);

  durations.forEach(function (duration) {
    totalInMillis          += duration;
    totalExclusiveInMillis += duration;
    sumOfSquares           += duration * duration;
  });

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

function Trace() {
  var active = true
    , start = Date.now()
    , finish
    ;

  this.end = function () {
    if (!active) return;

    finish = Date.now();
    active = false;
  };

  this.durationInMillis = function () {
    return finish - start;
  };
}

function Transaction(application) {
  var active = true
    , start  = Date.now()
    , scoped = {}
    , unscoped = {}
    , finish
    ;

  if (!application) throw new Error('every transaction must be scoped to an application');

  this.application = application;

  this.end = function () {
    if (!active) return;

    Object.keys(unscoped).forEach(function (key) {
      unscoped[key].forEach(function (trace) {
        trace.end();
      });
    });

    finish = Date.now();
    active = false;
  };

  this.isActive = function () {
    return active;
  };

  this.measure = function (name, scope) {
    // throwing is unsafe in asynchronous contexts, so silently return
    if (!active) return;

    var trace = new Trace();

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

  this.metrics = function (name, scope) {
    if (scope) {
      return scoped[scope][name];
    }
    else {
      return unscoped[name];
    }
  };

  this.statistics = function (name, scope) {
    if (!(name || scope)) {
      return this.summary();
    }
    else {
      return new MetricSummary(this.metrics(name, scope));
    }
  };

  this.summary = function () {
    var self = this;

    var summary = {
      scoped : [],
      unscoped : []
    };

    Object.keys(scoped).forEach(function (scope, i, a) {
      var names = {};
      Object.keys(scoped[scope]).forEach(function (name, i, a) {
        names[name] = new MetricSummary(self.metrics(name, scope));
      });
      summary.scoped[scope] = names;
    });

    Object.keys(unscoped).forEach(function (name, i, a) {
      summary.unscoped[name] = new MetricSummary(self.metrics(name));
    });

    return summary;
  };
}

var transactions = {};

exports.create = function (application) {
  var blank = new Transaction(application);

  if (!transactions[application.name]) transactions[application.name] = [];
  transactions[application.name].push(blank);

  return blank;
};

exports.byApplication = function (application) {
  return transactions[application.name];
};

exports.active = function (application) {
  return transactions[application.name].filter(function (transaction) { return transaction.isActive(); });
};

/**
 * Used for testing
 */
exports.reset = function () {
  Object.keys(transactions).forEach(function (key) {
    transactions[key].forEach(function (transaction, index) { transaction.end(); });
  });
  transactions = {};
};
