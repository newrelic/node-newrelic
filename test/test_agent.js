var winston = require('winston');
var logger = require('../lib/logger.js').getLogger();
var stats = require('../lib/stats.js');
var trace = require('../lib/trace.js');

exports.createAgent = function() {
    return new function() {
        logger.logToConsole();
        logger.setLevel('debug');
        this.transactions = [];
        this.transactionFinished = function(transaction) {
            this.transactions.push(transaction);
        }

        var statsEngine = stats.createStatsEngine(logger);
        trace.setTransactions(this);
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



