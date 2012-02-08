var winston = require('winston');
var logger = require('../lib/logger.js').getLogger();

exports.createAgent = function() {
	return new function() {
		logger.logToConsole();
		this.getLogger = function() {
			return logger;
		}
	
		var config = require('../lib/config.js').initialize({'config':{'app_name':'node.js Tests'}});
		this.getConfig = function() {
			return config;
		}
	
		this.getVersion = function() {
			return '0.66.6';
		}
	}
}



