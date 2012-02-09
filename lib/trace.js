__TRANSACTION_ID = 0;

var stats = require('./stats.js')
var metrics = require('./metric.js');
var logger = require('./logger.js').getLogger();

function Transaction(agent) {
    var self = this;
    var unscopedStats = new stats.StatsCollection(agent.getStatsEngine());
    var scopedStats = new stats.StatsCollection(agent.getStatsEngine());
    
    var rootTracer;
    var tracers = []
	var _finished = false;
    this.id = __TRANSACTION_ID++;

    this.push = function(tracer) {		
        logger.debug("tx push", this.id, tracer);
		if (_finished) {
			logger.error("Tracer pushed onto a completed transaction");
			return false;
		}
        if (!rootTracer) {
            rootTracer = tracer;
        }
        tracers.push(tracer);
		return true;
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
            logger.error("Unexpected tracer", tracer);
        }
        
    }
	
	this.isWebTransaction = function() {
		return this.url;
	}
	
	this.isFinished = function() {
		return _finished;
	}
	
    
    function finished(tracer) {
		if (_finished) {
			logger.error("Tracer finished for a completed transaction");
			return;
		}
		_finished = true;
        logger.debug("transaction finished", self);
        if (self.url) {
            var scope = metrics.recordWebTransactionMetrics(unscopedStats, self.url, tracer.getDurationInMillis(), self.statusCode);
            if (scope) {
                tracers.forEach(function(tracer) {
                    if (!tracer.getEndTime()) {
                        logger.debug("Closing unclosed tracer");
                        tracer.finish();
                    }
                });
            }
        } else {
            // handle background stuff
			scope = "FIXME";
        }
        agent.getStatsEngine().getUnscopedStats().merge(unscopedStats);
        agent.getStatsEngine().getScopedStats(scope).merge(scopedStats);

		agent.clearTransaction(self);
    }
    
}

function Tracer(transaction, metricNameOrCallback) {
    var self = this;
    var start = new Date();
    var end;
	
    var good = transaction.push(this);
    
    this.finish = function() {
        if (!end) {
            end = new Date();
			if (good) {
				transaction.pop(this);
			}
        }
    }
	
	this.getTransaction = function() {
		return transaction;
	}
	
	this.getStartTime = function() {
		return start;
	}
	
	this.getEndTime = function() {
		return end;
	}
    
    this.getDurationInMillis = function() {
        var _end = end ? this.getEndTime() : new Date();
        return _end - this.getStartTime();
    }
    
    this.getExclusiveDurationInMillis = function() {
        return this.getDurationInMillis();
    }
    
    this.recordMetrics = function(unscopedStats, scopedStats) {
//        console.log("harvest tracer. " + metricName + " Total: " + this.getDurationInMillis() + " Exclusive: " + this.getExclusiveDurationInMillis());
        if (typeof(metricNameOrCallback) == 'string') {
            scopedStats.getStats(metricNameOrCallback).recordValueInMillis(this.getDurationInMillis(), this.getExclusiveDurationInMillis());
        } else if (metricNameOrCallback) {
            metricNameOrCallback(self, unscopedStats, scopedStats);
        }
    }
}

exports.createTransaction = function(agent) { return new Transaction(agent) };
exports.Tracer = Tracer;
