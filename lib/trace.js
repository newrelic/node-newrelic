__TRANSACTION_ID = 0;

var stats = require('./stats.js')
var _agent = require('newrelic_agent');

function Transaction(agent) {
    var self = this;
    var unscopedStats = new stats.StatsCollection();
    var scopedStats = new stats.StatsCollection();
    logger = _agent.getLogger();
    
    var rootTracer;
    var tracers = []
	var _finished = false;
    this.id = __TRANSACTION_ID++;

    this.push = function(tracer) {
        logger.debug("tx push", this.id, tracer);
        if (!rootTracer) {
            rootTracer = tracer;
        }
        tracers.push(tracer);
    }
    
    this.pop = function(tracer) {
        logger.debug("tx pop", this.id, tracer);
        if (tracers.indexOf(tracer) >= 0) {
            tracer.recordMetrics(unscopedStats, scopedStats);
            if (tracer == rootTracer) {
                finished(tracer);
            }
        } else {
            // FIXME error
            logger.debug("Unexpected tracer", tracer);
        }
        
    }
	
	this.isWebTransaction = function() {
		return this.url;
	}
	
	this.isFinished = function() {
		return _finished;
	}
	
    
    function finished(tracer) {
		_finished = true;
        logger.debug("transaction finished", self);
        if (self.url) {
            var scope = agent.getMetrics().recordTransaction(self.url, tracer.getDurationInMillis(), self.statusCode);
            if (scope) {
                tracers.forEach(function(tracer) {
                    if (!tracer.end) {
                        logger.debug("Closing unclosed tracer");
                        tracer.finish();
                    }
                });
                agent.getStatsEngine().getUnscopedStats().merge(unscopedStats);
                agent.getStatsEngine().getScopedStats(scope).merge(scopedStats);
            }
        } else {
            // handle background stuff
        }
		agent.clearTransaction(self);
    }
    
}

function Tracer(transaction, metricNameOrCallback) {
    var self = this;
    this.begin = new Date();
    logger = _agent.getLogger();
    
    transaction.push(this);
    
    this.finish = function() {
        if (!self.end) {
            self.end = new Date();
            transaction.pop(this);
        }
    }
	
	this.getTransaction = function() {
		return transaction;
	}
    
    this.getDurationInMillis = function() {
        var end = self.end ? self.end : new Date();
        return end - self.begin;
    }
    
    this.getExclusiveDurationInMillis = function() {
        return this.getDurationInMillis();
    }
    
    this.recordMetrics = function(unscopedStats, scopedStats) {
//        console.log("harvest tracer. " + metricName + " Total: " + this.getDurationInMillis() + " Exclusive: " + this.getExclusiveDurationInMillis());
        if (typeof(metricNameOrCallback) == 'string') {
            scopedStats.getStats(metricName).recordValueInMillis(this.getDurationInMillis(), this.getExclusiveDurationInMillis());
        } else if (metricNameOrCallback) {
            metricNameOrCallback(self, unscopedStats, scopedStats);
        }
    }
}

exports.createTransaction = function(agent) { return new Transaction(agent) };
exports.Tracer = Tracer;
