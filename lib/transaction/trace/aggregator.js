'use strict';

var path         = require('path')
  , util         = require('util')
  , EventEmitter = require('events').EventEmitter
  , logger       = require(path.join(__dirname, '..', '..', 'logger'))
  ;

function TraceAggregator (config) {
  EventEmitter.call(this);

  if (!config) throw new Error("Trace aggregator needs configuration at startup.");

  this.config = config.transaction_tracer || {};
  // default to the "old" slowest-transaction behavior unless top N is configured
  this.size = this.config.top_n ? this.config.top_n : 1;

  this.requestTimes = Object.create(null);
  this.traces       = [];
}
util.inherits(TraceAggregator, EventEmitter);

/**
 * Triggers a harvest cycle, which emits a set of captured transaction traces
 * and does any necessary internal state cleansing.
 *
 * Emits 'harvest' with any returned trace data.
 */
TraceAggregator.prototype.harvest = function harvest() {
  var harvested = this.traces;
  this.traces = [];

  this.emit('harvest', harvested);
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
    var trace  = transaction.getTrace();
    var apdexT = transaction.metrics.apdexT;

    // the transaction knows what apdexT was when it was created
    if (trace.getDurationInMillis() > 4 * 1000 * apdexT) {
      this.requestTimes[transaction.scope] = trace.getDurationInMillis();
      var self = this;
      trace.generateJSON(function stashTrace(err, encoded) {
        if (err) return logger.warn("Unable to generate trace JSON:", err);

        self.traces.push(encoded);
        self.emit('capture');
      });
    }
    else {
      this.emit('capture');
    }
  }
};

module.exports = TraceAggregator;
