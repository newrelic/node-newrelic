var __TRANSACTION_ID = 0;

var path    = require('path')
  , events  = require('events')
  , util    = require('util')
  , stats   = require(path.join(__dirname, 'stats'))
  , metrics = require(path.join(__dirname, 'metric'))
  , logger  = require(path.join(__dirname, 'logger'))
  ;

var noop = function () {};

function rawStack(error, structuredStackTrace) {
  return structuredStackTrace;
}

function getRawStack(error) {
  var prepareStackTrace = Error.prepareStackTrace;
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
    Error.prepareStackTrace = prepareStackTrace;
  }
}

function appendToStackAndFindParent(tracer, error) {
  var stack = getRawStack(error);
  // append the tracer at the top of the stack
  stack[0].fun.__NR_TRACER = tracer;
  // start at one to skip the top of the stack (we'd find the current tracer)
  for (var i = 1, len = stack.length; i < len; i++) {
    if (stack[i].fun.__NR_TRACER) {
      return stack[i].fun.__NR_TRACER;
    }
  }
}


/**
 * Transactions: collection with event handler
 */

function Transactions() {
  events.EventEmitter.call(this);
}
util.inherits(Transactions, events.EventEmitter);

Transactions.prototype.transactionFinished = function (transaction) {
  this.emit('transactionFinished', transaction);
};

var transactions = new Transactions();


/**
 * Transaction: a scope for gathering runtime statistics on an app operation
 */

function Transaction(agent) {
  var self = this;

  var tracers = [];
  var totalExclusive = 0;

  this.finished = false;
  this.id = __TRANSACTION_ID++;
  this.scopedStats = new stats.Collection(agent.statsEngine);
  this.unscopedStats = new stats.Collection(agent.statsEngine);

  function finish(tracer) {
    if (self.finished) {
      logger.error("Tracer finished for a completed transaction: " + tracer.getName());
      return;
    }

    try {
      logger.debug(function transactionFinished() { return self; });
      if (self.url) {
        self.scope = metrics.recordWebTransactionMetrics(agent.metricNormalizer,
                                                         self.unscopedStats,
                                                         self.url,
                                                         tracer.getDurationInMillis(),
                                                         totalExclusive,
                                                         self.statusCode);
      }
      else {
        // handle background stuff
        self.scope = "FIXME";
        logger.debug("A transaction with no scope was detected.  This is likely due to a framework instrumentation issue.");
        if (this.scopedStats) {
          logger.debug("Scoped metrics: " + JSON.stringify(this.scopedStats));
        }
      }

      if (self.scope) {
        tracers.forEach(function (tracer) {
          if (!tracer.end) {
            logger.debug("Closing unclosed tracer : " + tracer.getName());
            tracer.finish();
            logger.debug("Unclosed tracer duration: " + tracer.getDurationInMillis());
          }
        });

        transactions.transactionFinished(self);
      }
    }
    finally {
      self.finished = true;
    }
    agent.clearTransaction(self);
  }

  this.push = function (tracer) {
    logger.debug(function txPush() { return tracer; });

    if (self.finished) {
      logger.error("attempt to push tracer onto a completed transaction");
      return false;
    }

    tracers.push(tracer);

    return true;
  };

  this.pop = function (tracer) {
    logger.debug(function txPop() { return tracer; });
    if (tracers.indexOf(tracer) >= 0) {
      tracer.recordMetrics(this.unscopedStats, this.scopedStats);
      totalExclusive += tracer.getExclusiveDurationInMillis();
      if (tracer === tracers[0]) {
        finish(tracer);
      }
    }
    else {
      // FIXME error
      logger.error("Unexpected tracer", tracer);
    }
  };

  this.toJSON = function () {
    if (this.url) {
      return [this.url, this.statusCode, tracers[0]];
    }
    else {
      return ["background transaction", tracers[0]];
    }
  };
}

Transaction.prototype.isWebTransaction = function () {
  return this.url ? true : false;
};


/**
 * Timer: A simple object for encapsulating transaction duration.
 */

function Timer() {
  var finished = false;

  this.start = Date.now();
  this.stop = function () {
    if (finished) throw new Error('tried to stop finished timer.');

    this.end = Date.now();
    finished = true;
  };
}

Timer.prototype.getDurationInMillis = function () {
  return this.end - this.start;
};


/**
 * Tracer: Transaction controller.
 */

function Tracer(transaction, metricNameOrCallback) {
  Timer.call(this);

  this.transaction = transaction;
  this.metricNameOrCallback = metricNameOrCallback;

  this._childDurationInMillis = 0;

  // Only allow the manipulation of this transaction if it hasn't
  // yet completed.
  if (transaction.push(this)) {
    this.appendToStack = function (error) {
      this._parent = appendToStackAndFindParent(this, error);
    };

    this.popFromTransaction = function () {
      transaction.pop(this);
      if (this._parent) this._parent.childFinished(this);
    };
  }
  else {
    this.appendToStack = this.popFromTransaction = noop;
  }
}
util.inherits(Tracer, Timer);

Tracer.prototype.toJSON = function () {
  return [ this.metricNameOrCallback, this.getDurationInMillis(), this.getExclusiveDurationInMillis()];
};

Tracer.prototype.getName = function () {
  return util.inspect(this.metricNameOrCallback);
};

Tracer.prototype.recordMetrics = function (unscopedStats, scopedStats) {
  var metricNameOrCallback = this.metricNameOrCallback;
  if (typeof(metricNameOrCallback) === 'string') {
    scopedStats.byName(metricNameOrCallback).recordValueInMillis(this.getDurationInMillis(), this.getExclusiveDurationInMillis());
  }
  else if (metricNameOrCallback) {
    metricNameOrCallback(this, unscopedStats, scopedStats);
  }
};

Tracer.prototype.getExclusiveDurationInMillis = function () {
  return Math.max(0, this.getDurationInMillis() - this._childDurationInMillis);
};

Tracer.prototype.childFinished = function (child) {
  this._childDurationInMillis += child.getDurationInMillis();
};

Tracer.prototype.finish = function () {
  this.stop();
  this.popFromTransaction();
};

var noopTracer = {
  finish : noop,
  appendToStack : noop,
  dummy : true
};


/*
 * exported API
 */

exports.Timer = Timer;
exports.Tracer = Tracer;

exports.createTransaction = function (agent) {
  return new Transaction(agent);
};

exports.createTracer = function (agent, metricNameOrCallback) {
  var tx = agent.getTransaction();
  return tx ? new Tracer(tx, metricNameOrCallback) : noopTracer;
};

exports.addTransactionListener = function (obj, callback) {
  transactions.on('transactionFinished', function () {
    callback.apply(obj, arguments);
  });
};

// only for testing
exports.getRawStack = getRawStack;

exports.setTransactions = function (_transactions) {
  transactions = _transactions;
};
