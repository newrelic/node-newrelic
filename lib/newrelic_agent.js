var module = require('module');

var fs = require('fs');
var stats = require('./stats.js');
var service = require('./service.js');
var metric = require('./metric.js');
var trace = require('./trace.js');
var events = require('events');
var winston = require('winston');

function Agent() {
    events.EventEmitter.call(this);
    var self = this;
    var logger = require('./logger.js').getLogger();
    var config = require('./config.js').initialize(logger);
    var version = config.getVersion();
    
    var statsEngine = stats.createStatsEngine(logger);
    config.on('change', statsEngine.onConnect);
    var metrics = new metric.Metrics(statsEngine);

    // NewRelicService
    var nrService;
    var harvestIntervalId;
    
    this.stop = function() {
        logger.info('Stopping the New Relic node.js agent');
        clearInterval(harvestIntervalId);
    };
    
    this.getConfig = function() {
        return config;
    }
    
    this.getVersion = function() {
        return version;
    }
    
    this.noticeAppPort = function(port) {
        this.applicationPort = port;
        logger.debug("Noticed application running on port " + port);
    }

    function connect() {
        setTimeout(function() {
            doConnect();
        }, this.applicationPort ? 0 : 1000);
    }

    function doConnect() {
		
        if (nrService) {
            return;
        }
		var licenseKey = config['license_key'];
		var host = config['host'];
		var port = config.getPort();
		
        nrService = service.createNewRelicService(self, licenseKey, host, port);
        nrService.on('connect', config.onConnect);
        nrService.on('metricDataError', statsEngine.mergeMetricData);
        nrService.on('metricDataResponse', statsEngine.parseMetricIds);
        nrService.on('connectError', function(error) {
            setTimeout(function() {
                logger.error("An error occurred connecting to " + host + ":" + port + " - " + error);
                connect();
            }, 15*1000);
        });
        nrService.connect();
    }
    
    this.getLogger = function() {
        return logger;
    }
    
    this.getStatsEngine = function() {
        return statsEngine;
    }
    
    this.getMetrics = function() {
        return metrics;
    }

    /*
    function patchModule() {
        var module = require('module');
        
        // append the agent exports to module
        module.newrelic_agent = exports;
    
        var moduleLoadFunction = module._load;
    
        module._load = function(file) {        
            var m = moduleLoadFunction(file);
            moduleLoad(module, m, file);
            return m;
        }
    };
    
    function moduleLoad(modules, module, file) {
    //console.log("Load file: " + file);
    // FIXME here's where we'd notice modules loading.  we'd need to sort out native/custom modules
    };

    */
    
    function loadInstrumentation() {
        var fs = require('fs');
		var path = require('path');
        var coreDir = path.join(__dirname,'core_instrumentation');
        var files = fs.readdirSync(coreDir);
        
        // load the core instrumentation files
        files.forEach(function(name) {
            var fileName = coreDir + "/" + name;
            var inst = require(fileName);
            var success = true;
            try {
                inst.initialize(self, trace);
            } catch(e) {
				logger.debug(e);
                success = false;
            }
            logger.debug("Module " + fileName + " : " + success);
        });
    }
    
    function harvest() {
        self.emit('harvest', nrService);
        logger.debug("Harvest");
        if (nrService && nrService.isConnected()) {
            statsEngine.harvest(nrService);
        }
    }
    
    function startHarvest() {
        harvestIntervalId = setInterval(harvest, 60*1000);
    }

     this.start = function() {
        logger.info('Starting the New Relic node.js agent');
    
//        patchModule();
    
        loadInstrumentation();
        startHarvest();
		connect();
    };
    
    this.clearTransaction = function(transaction) {
        if (self.transaction == transaction) {
            self.transaction = null;
        }
    }
	
	this.setTransaction = function(transaction) {
		if (!(transaction && transaction.isFinished())) {
			self.transaction = transaction;
		}
	}
	
	this.getTransaction = function() {
		if (self.transaction) {
			if (self.transaction.isFinished()) {
				self.transaction = null;
			}
			return self.transaction;
		}
		return null;
	}
    
    this.createTransaction = function() {
        return self.transaction = trace.createTransaction(self);
    }
};

Agent.super_ = events.EventEmitter;
Agent.prototype = Object.create(events.EventEmitter.prototype, {
    constructor: {
        value: Agent,
        enumerable: false
    }
});

var agent = new Agent();

exports.stop = agent.stop;
exports.connect = agent.connect;
exports.getStatsEngine = agent.getStatsEngine;
exports.createTransaction = agent.createTransaction;
exports.getMetrics = agent.getMetrics;
exports.getLogger = agent.getLogger;
exports.logToConsole = function() {
    agent.getLogger().add(winston.transports.Console);
}

agent.start();


function generateShim(next, name) {
    var _currentTransaction = agent.getTransaction();
	if (_currentTransaction && _currentTransaction.isFinished()) {
		agent.clearTransaction(_currentTransaction);
		_currentTransaction = null;
	}
	// we only need to wrap if there's a transaction to pass
/*
	if (!_currentTransaction) {
		return next;
	}*/
	
    return function() {
        agent.setTransaction(_currentTransaction);
		try {
			return next.apply(this, arguments);
		} catch (e) {
			if (e == "TypeError: Cannot call method 'emit' of null") {
				// FIXME not sure why this is happening
			} else {
				throw e;
			}
		}
    };
}

// Thanks Adam Crabtree! (dude@noderiety.com)
require('./hook.js')(generateShim);
