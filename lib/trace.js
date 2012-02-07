__TRANSACTION_ID = 0;

var stats = require('./stats.js')
var _agent = require('newrelic_agent');

function Transaction(agent) {
	var self = this;
	var unscopedStats = new stats.StatsCollection();
	var scopedStats = new stats.StatsCollection();
	logger = _agent.getLogger();
	
	var lastTracer;
	var rootTracer;
	this.id = __TRANSACTION_ID++;

	this.push = function(tracer) {
		logger.debug("tx push", this.id, tracer);
		if (rootTracer) {
			tracer.parentTracer = lastTracer;
		} else {
			rootTracer = tracer;
		}
		lastTracer = tracer;
	}
	
	function finished(tracer) {
		logger.debug("transaction finished", self);
		if (self.url) {
			var scope = agent.getMetrics().recordTransaction(self.url, tracer.getDurationInMillis(), self.statusCode);
			if (scope) {
				agent.getStatsEngine().getUnscopedStats().merge(unscopedStats);
				agent.getStatsEngine().getScopedStats(scope).merge(scopedStats);
			}
		} else {
			// handle background stuff
		}
	}
	
	this.pop = function(tracer) {
		logger.debug("tx pop", this.id, tracer);
		if (tracer == lastTracer) {
			tracer.recordMetrics(unscopedStats, scopedStats);
			if (tracer == rootTracer) {
				finished(tracer);
			} else {
				lastTracer = tracer.parentTracer;
				lastTracer.childFinished(tracer);
			}
		} else {
			// FIXME ERROR
			logger.debug("ERROR : unexpected tracer");
		}
	}	
}

function Tracer(transaction, metricName, metricCallback) {
	var self = this;
	this.begin = new Date();
	logger = _agent.getLogger();
	
	this.childDuration = 0;
	
	transaction.push(this);
	
	this.finish = function() {
		self.end = new Date();
		transaction.pop(this);
	}
	
	this.childFinished = function(child) {
		self.childDuration += child.getDurationInMillis();
	}
	
	this.getDurationInMillis = function() {
		var end = self.end ? self.end : new Date();
		return end - self.begin;
	}
	
	this.getExclusiveDurationInMillis = function() {
		return this.getDurationInMillis() - self.childDuration;
	}
	
	this.recordMetrics = function(unscopedStats, scopedStats) {
//		console.log("harvest tracer. " + metricName + " Total: " + this.getDurationInMillis() + " Exclusive: " + this.getExclusiveDurationInMillis());
		if (metricName) {
			scopedStats.getStats(metricName).recordValueInMillis(this.getDurationInMillis(), this.getExclusiveDurationInMillis());
		}
		if (metricCallback) {
			metricCallback.recordMetrics(unscopedStats, scopedStats);
		}
	}
}

exports.createTransaction = function(agent) { return new Transaction(agent) };
exports.Tracer = Tracer;
