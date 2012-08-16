'use strict';

var path         = require('path')
  , logger       = require(path.join(__dirname, '..', 'logger'))
  ;

var __TRANSACTION_ID = 0;

/**
 * Transaction: a scope for gathering runtime statistics on an app operation
 */
function Transaction(agent, transactions) {
  this.agent = agent;
  this.transactions = transactions;

  this.id = __TRANSACTION_ID++;

  this.finished = false;
  this.tracers = [];
  this.totalExclusive = 0;
}

Transaction.prototype.finish = function (tracer) {
  if (this.finished) {
    logger.debug("Tracer finished for a completed transaction: " + tracer.getName());
    return;
  }

  try {
    if (this.url) {
      this.scope = this.agent.metrics.recordWebTransaction(this.agent.metricNormalizer,
                                                           this.url,
                                                           tracer.getDurationInMillis(),
                                                           this.totalExclusive,
                                                           this.statusCode);
    }
    else {
      // handle background stuff
      this.scope = "FIXME";
      logger.debug("A transaction with no scope was detected. " +
                   "This is likely due to a framework instrumentation issue.");
    }

    if (this.scope) {
      this.tracers.forEach(function (tracer) {
        if (!tracer.finished) tracer.finish();
      });

      this.transactions.transactionFinished(this);
    }
  }
  finally {
    this.finished = true;
  }
  this.agent.clearTransaction(this);
};

Transaction.prototype.push = function (tracer) {
  if (this.finished) {
    logger.debug("attempt to push tracer onto a completed transaction");
    return false;
  }

  this.tracers.push(tracer);

  return true;
};

Transaction.prototype.pop = function (tracer) {
  if (this.tracers.indexOf(tracer) >= 0) {
    tracer.recordMetrics(this.agent.metrics);
    this.totalExclusive += tracer.getExclusiveDurationInMillis();

    if (tracer === this.tracers[0]) this.finish(tracer);
  }
  else {
    // FIXME error
    logger.debug("Unexpected tracer", tracer);
  }
};

Transaction.prototype.toJSON = function () {
  if (this.url) {
    return [this.url, this.statusCode, this.tracers[0]];
  }
  else {
    return ["background transaction", this.tracers[0]];
  }
};

Transaction.prototype.isWebTransaction = function () {
  return this.url ? true : false;
};

module.exports = Transaction;
