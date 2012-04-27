var __TRANSACTION_ID = 0;

var events  = require('events')
  , stats   = require('./stats')
  , metrics = require('./metric')
  , logger  = require('./logger')
  , util    = require('util')
  ;

var noop = function () {};

function appendToStackAndFindParent(tracer, error) {
  var stack = getRawStack(error);
  // append the tracer at the top of the stack
  stack[0].fun.NR_TRACER = tracer;
  // start at one to skip the top of the stack (we'd find the current tracer)
  for (var i = 1, len = stack.length; i < len; i++) {
    if (stack[i].fun.NR_TRACER) {
      return stack[i].fun.NR_TRACER;
    }
  }
}

function rawStack(error, structuredStackTrace) {
  return structuredStackTrace;
}

function getRawStack(error) {
  Error.original_prepareStackTrace = Error.prepareStackTrace;
  try {
    error = error || new Error();
    Error.prepareStackTrace = rawStack;
    var stack = error.stack;
    if (Array.isArray(stack)) {
      return Array.prototype.slice.call(stack, 1);
    }
    else {
      return stack;
    }
  }
  finally {
    Error.prepareStackTrace = Error.original_prepareStackTrace;
    delete Error.original_prepareStackTrace;
  }
}

exports.getRawStack = getRawStack;

function Transactions() {
  events.EventEmitter.call(this);
}
util.inherits(Transactions, events.EventEmitter);

Transactions.prototype.transactionFinished = function (transaction) {
  this.emit('transactionFinished', transaction);
};

var transactions = new Transactions();
exports.addTransactionListener = function (obj, callback) {
  transactions.on('transactionFinished', function () {
    callback.apply(obj, arguments);
  });
};
// only for testing
exports.setTransactions = function (_transactions) {
  transactions = _transactions;
};

function Transaction(agent) {
  var self = this;
  var unscopedStats = new stats.StatsCollection(agent.statsEngine);
  var scopedStats = new stats.StatsCollection(agent.statsEngine);

  var rootTracer;
  var tracers = [];
  var totalExclusive = 0;
  var _finished = false;
  this.id = __TRANSACTION_ID++;

  this.push = function (tracer) {
    logger.debug(function txPush() { return tracer; });
    if (_finished) {
      logger.error("Tracer pushed onto a completed transaction");
      return false;
    }

    if (!rootTracer) {
      rootTracer = tracer;
    }

    tracers.push(tracer);
    return true;
  };

  this.pop = function (tracer) {
    logger.debug(function txPop() { return JSON.stringify(tracer); });
    if (tracers.indexOf(tracer) >= 0) {
      tracer.recordMetrics(unscopedStats, scopedStats);
      totalExclusive += tracer.getExclusiveDurationInMillis();
      if (tracer === rootTracer) {
        finished(tracer);
      }
    }
    else {
      // FIXME error
      logger.error("Unexpected tracer", tracer);
    }
  };

  this.isFinished = function () {
    return _finished;
  };

  this.getUnscopedStats = function () { return unscopedStats; };
  this.getScopedStats = function () { return scopedStats; };

  this.toJSON = function () {
    if (this.url) {
      return [this.url, this.statusCode, rootTracer];
    }
    else {
      return ["background transaction", rootTracer];
    }
  };

  function finished(tracer) {
    if (_finished) {
      logger.error("Tracer finished for a completed transaction: " + tracer.getName());
      return;
    }
    try {
      logger.debug(function transactionFinished() { return self; });
      if (self.url) {
        self.scope = metrics.recordWebTransactionMetrics(agent.metricNormalizer, unscopedStats,
                                                         self.url, tracer.getDurationInMillis(), totalExclusive, self.statusCode);
      }
      else {
        // handle background stuff
        self.scope = "FIXME";
        logger.debug("A transaction with no scope was detected.  This is likely due to a framework instrumentation issue.");
        logger.debug("Scoped metrics: " + JSON.stringify(scopedStats));
      }

      if (self.scope) {
        tracers.forEach(function (tracer) {
          if (!tracer.getEndTime()) {
            logger.debug("Closing unclosed tracer : " + tracer.getName());
            tracer.finish();
            logger.debug("Unclosed tracer duration: " + tracer.getDurationInMillis());
          }
        });

        transactions.transactionFinished(self);
      }
    }
    finally {
      _finished = true;
    }
    agent.clearTransaction(self);
  }
}

Transaction.prototype.isWebTransaction = function () {
  return this.url;
};

function Timer() {
  var self = this;
  var start = new Date();
  var end;

  this.stop = function () {
    end = new Date();
    self.stop = noop;
  };

  this.getStartTime = function () { return start; };
  this.getEndTime = function () { return end || new Date(); };
}

Timer.prototype.getDurationInMillis = function () {
  return this.getEndTime() - this.getStartTime();
};

function Tracer(transaction, metricNameOrCallback) {
  Timer.call(this);
  var self = this;
  this._childDurationInMillis = 0;

  this.getMetricNameOrCallback = function () { return metricNameOrCallback; };
  this.getTransaction = function () { return transaction; };

  var good = transaction.push(this);
  this.appendToStack = good ?  function (error) { this._parent = appendToStackAndFindParent(this, error); } : noop;

  this.popFromTransaction = good ?  function () {
      transaction.pop(self);
      if (this._parent) {
        this._parent.childFinished(self);
      }
    } : noop;

}
util.inherits(Tracer, Timer);

Tracer.prototype.toJSON = function () {
  return [ this.getMetricNameOrCallback(), this.getDurationInMillis(), this.getExclusiveDurationInMillis()];
};

Tracer.prototype.finish = function () {
  this.stop();
  this.popFromTransaction();
};

Tracer.prototype.childFinished = function (child) {
  this._childDurationInMillis += child.getDurationInMillis();
};

Tracer.prototype.recordMetrics = function (unscopedStats, scopedStats) {
  var metricNameOrCallback = this.getMetricNameOrCallback();
  if (typeof(metricNameOrCallback) == 'string') {
    scopedStats.getStats(metricNameOrCallback).recordValueInMillis(this.getDurationInMillis(), this.getExclusiveDurationInMillis());
  }
  else if (metricNameOrCallback) {
    metricNameOrCallback(this, unscopedStats, scopedStats);
  }
};

Tracer.prototype.getExclusiveDurationInMillis = function () {
  return Math.max(0, this.getDurationInMillis() - this._childDurationInMillis);
};

Tracer.prototype.getName = function () {
  return util.inspect(this.getMetricNameOrCallback());
};

var noopTracer = function () {
  this.finish = noop;
  this.dummy = true;
};

exports.createTransaction = function (agent) { return new Transaction(agent); };
exports.createTracer = function (agent, metricNameOrCallback) {
  var tx = agent.getTransaction();
  return tx ? new Tracer(tx, metricNameOrCallback) : noopTracer;
};
exports.Tracer = Tracer;
exports.Timer = Timer;
