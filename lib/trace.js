__TRANSACTION_ID = 0;

var events = require('events');
var stats = require('./stats');
var metrics = require('./metric');
var logger = require('./logger').getLogger();
var util = require('util');

var noop = function() {};

function Transactions() {
    events.EventEmitter.call(this);
}
util.inherits(Transactions, events.EventEmitter);

Transactions.prototype.transactionFinished = function(transaction) {
    this.emit('transactionFinished', transaction);
};

var transactions = new Transactions();
exports.addTransactionListener = function(listener) {
    transactions.on('transactionFinished', listener);
};
// only for testing
exports.setTransactions = function(_transactions) {
    transactions = _transactions;
};

function Transaction(agent) {
    var self = this;
    var unscopedStats = new stats.StatsCollection(agent.getStatsEngine());
    var scopedStats = new stats.StatsCollection(agent.getStatsEngine());
    
    var rootTracer;
    var tracers = [];
    var _finished = false;
    this.id = __TRANSACTION_ID++;

    this.push = function(tracer) {        
        logger.debug("tx push", this.id, util.inspect(tracer));
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
    
    this.pop = function(tracer) {
        logger.debug("tx pop", this.id, tracer);
        if (tracers.indexOf(tracer) >= 0) {
            tracer.recordMetrics(unscopedStats, scopedStats);
            if (tracer == rootTracer) {
                finished(tracer);
            }
        } else {
            // FIXME error
            logger.error("Unexpected tracer", tracer);
        }
        
    };   
    
    this.isFinished = function() {
        return _finished;
    };
    
    this.getUnscopedStats = function() { return unscopedStats; };
    this.getScopedStats = function() { return scopedStats; };
    
    function finished(tracer) {
        if (_finished) {
            logger.error("Tracer finished for a completed transaction: " + tracer.getName());
            return;
        }
        try {
            logger.debug("transaction finished", self);
            if (self.url) {
                self.scope = metrics.recordWebTransactionMetrics(agent.getMetricNormalizer(), unscopedStats, self.url, tracer.getDurationInMillis(), self.statusCode);
            } else {
                // handle background stuff
                self.scope = "FIXME";
            }
        
            if (self.scope) {
                tracers.forEach(function(tracer) {
                    if (!tracer.getEndTime()) {
                        logger.debug("Closing unclosed tracer : " + tracer.getName());
                        tracer.finish();
                        logger.debug("Unclosed tracer duration: " + tracer.getDurationInMillis());
                    }
                });
            
                transactions.transactionFinished(self);
            }
        } finally {
            _finished = true;
        }
        agent.clearTransaction(self);
    }
    
}

Transaction.prototype.isWebTransaction = function() {
    return this.url;
};

function Timer() {
	var self = this;
    var start = new Date();
    var end;
    
    this.stop = function() {
        end = new Date();
        self.stop = noop;
    };
    
    this.getStartTime = function() {
        return start;
    };
    
    this.getEndTime = function() {
        return end || new Date();
    };
}

Timer.prototype.getDurationInMillis = function() {
    return this.getEndTime() - this.getStartTime();
};

function Tracer(transaction, metricNameOrCallback) {
	Timer.call(this);
    var self = this;
    
    var good = transaction.push(this);
    
    this.popFromTransaction = good ? function() { transaction.pop(self);} : noop;
    
    this.getMetricNameOrCallback = function() {
    	return metricNameOrCallback;
    };
    
    this.getTransaction = function() {
        return transaction;
    };
    
    this.finish = function() {
    	self.stop();
    	self.popFromTransaction();
    	self.popFromTransaction = noop;
    };
}
util.inherits(Tracer, Timer);

Tracer.prototype.recordMetrics = function(unscopedStats, scopedStats) {
	var metricNameOrCallback = this.getMetricNameOrCallback();
    if (typeof(metricNameOrCallback) == 'string') {
        scopedStats.getStats(metricNameOrCallback).recordValueInMillis(this.getDurationInMillis(), this.getExclusiveDurationInMillis());
    } else if (metricNameOrCallback) {
        metricNameOrCallback(this, unscopedStats, scopedStats);
    }
};

Tracer.prototype.getExclusiveDurationInMillis = function() {
    return this.getDurationInMillis();
};

Tracer.prototype.getName = function() {
	return util.inspect(this.getMetricNameOrCallback());
};

exports.createTransaction = function(agent) { return new Transaction(agent); };
exports.Tracer = Tracer;
exports.Timer = Timer;
