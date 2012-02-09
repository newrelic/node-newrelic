var winston = require('winston');
var logger = require('../lib/logger.js').getLogger();
var stats = require('../lib/stats.js');

exports.createAgent = function() {
	return new function() {
		logger.logToConsole();
		var statsEngine = stats.createStatsEngine(logger);
		this.getLogger = function() {
			return logger;
		}
	
		var config = require('../lib/config.js').initialize(logger, {'config':{'app_name':'node.js Tests'}});
		this.getConfig = function() {
			return config;
		}
	
		this.getVersion = function() {
			return '0.66.6';
		}
		
		this.getStatsEngine = function() {
			return statsEngine;
		}
		
		this.clearTransaction = function() {			
		}
	}
}



