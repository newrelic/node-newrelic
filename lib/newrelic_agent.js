var module = require('module');

var path = require('path');
var fs = require('fs');
var stats = require('./stats');
var service = require('./service');
var metric = require('./metric');
var error = require('./error');
var trace = require('./trace');
var events = require('events');
var util = require('util');
var winston = require('winston');

function Agent() {
    events.EventEmitter.call(this);
    var self = this;
    var logger = require('./logger').getLogger();
    var config = require('./config').initialize(logger);
    var version = config.getVersion();
	var instrumentation = [];
	var metricNormalizer = new metric.MetricNormalizer(logger);
	var errorService = new error.ErrorService(logger, config);
	trace.addTransactionListener(errorService.onTransactionFinished);
	
	logger.setLevel(config.getLogLevel());
    
    var statsEngine = stats.createStatsEngine(logger);
	trace.addTransactionListener(statsEngine.onTransactionFinished);
    config.on('change', statsEngine.onConnect);

    // NewRelicService
    var nrService;
    var harvestIntervalId;
    
    this.stop = function() {
        logger.info('Stopping the New Relic node.js agent');
        clearInterval(harvestIntervalId);
    };
    
    this.getConfig = function() {
        return config;
    };
    
    this.getVersion = function() {
        return version;
    };
    
    this.noticeAppPort = function(port) {
        this.applicationPort = port;
        logger.debug("Noticed application running on port " + port);
    };

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
		nrService.on('connect', metricNormalizer.parseMetricRules);
        nrService.on('metricDataError', statsEngine.mergeMetricData);
        nrService.on('metricDataResponse', statsEngine.parseMetricIds);
        nrService.on('errorDataError', errorService.onSendError);
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
    };
    
    this.getStatsEngine = function() {
        return statsEngine;
    };
	
	this.getErrorService = function() {
		return errorService;
	};
	
	this.getMetricNormalizer = function() {
		return metricNormalizer;
	};

    // patch the module.load function so that we see modules loading and
	// have an opportunity to patch them with instrumentation
    function patchModule() {
        var module = require('module');    
        var moduleLoadFunction = module._load;
    
        module._load = function(file) {        
            var m = moduleLoadFunction.apply(this, arguments);
            moduleLoad(m, file);
            return m;
        };
    };
    
	// notice a module loading and patch it if there's a file in the instrumentation
	// directory with a name that matches the module name
    function moduleLoad(theModule, name) {
    	if (theModule.__NR_INITIALIZED) {
    		return;
    	}
		if (path.extname(name) == '.js') {
			return;
		}
        var instrumentationDir = path.join(__dirname,'instrumentation');
        var fileName = instrumentationDir + "/" + name + '.js';
		// we have to check this synchronously.  it's important that we patch immediately when modules load
		if (path.existsSync(fileName)) {
			// FIXME for some reason the logger doesn't work here.  console logging does.  wtf?
			loadInstrumentationFile(name, fileName, theModule);
			theModule.__NR_INITIALIZED = true;
		}
    };
    
	// we load all of the core instrumentation up front.  These are always available, they're
	// pretty much always used, and we might not see the modules load through our module patching.
    function loadInstrumentation() {
        var coreDir = path.join(__dirname,'core_instrumentation');
        var files = fs.readdirSync(coreDir);
        
        // load the core instrumentation files
        files.forEach(function(name) {
            var fileName = coreDir + "/" + name;
			loadInstrumentationFile(name, fileName, require(path.basename(name, ".js")));
        });
    }
	
	function loadInstrumentationFile(shortName, fileName, theModule) {
        var inst = require(fileName);
        var success = true;
        try {
            inst.initialize(self, trace, theModule);
        } catch(e) {
			logger.debug(e.message);
            success = false;
        }
        logger.debug("Module " + path.basename(shortName, ".js") + " : " + success);
		instrumentation.push(fileName);	
		return success;
	}
    
    function harvest() {
        logger.debug("Harvest");
        if (nrService && nrService.isConnected()) {
//			self.emit('beforeHarvest', statsEngine, nrService);
//			self.emit('harvest', statsEngine, nrService);
			errorService.onBeforeHarvest(statsEngine, nrService);
            statsEngine.harvest(nrService);
        }
    }
    
    function startHarvest() {
        harvestIntervalId = setInterval(harvest, 60*1000);
    }
    
    function sampleMemory() {
    	var mem = process.memoryUsage();
    	statsEngine.getUnscopedStats().getStats('Memory/Physical').recordValueInBytes(mem.heapUsed);
    }
    
    function startSampling() {
    	setInterval(sampleMemory, 5*1000);
    }

    this.start = function() {
        if (config['agent_enabled'] != true) {
			logger.info('The New Relic node.js agent is disabled');			
			return;
		}
        logger.info('Starting the New Relic node.js agent');
    
        patchModule();
    
        loadInstrumentation();
        startHarvest();
		connect();
		startSampling();
    };
    
    this.clearTransaction = function(transaction) {
        if (self.transaction == transaction) {
            self.transaction = null;
        }
    };
	
	this.setTransaction = function(transaction) {
		if (!(transaction && transaction.isFinished())) {
			self.transaction = transaction;
		}
	};
	
	this.getTransaction = function() {
		if (self.transaction) {
			if (self.transaction.isFinished()) {
				self.transaction = null;
			}
			return self.transaction;
		}
		return null;
	};
    
    this.createTransaction = function() {
        return self.transaction = trace.createTransaction(self);
    };
};

util.inherits(Agent, events.EventEmitter);

var agent = new Agent();

exports.stop = agent.stop;
exports.connect = agent.connect;
exports.getStatsEngine = agent.getStatsEngine;
exports.createTransaction = agent.createTransaction;
exports.getMetrics = agent.getMetrics;
exports.getLogger = agent.getLogger;
exports.logToConsole = function() {
    agent.getLogger().add(winston.transports.Console);
};

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
//        return next.apply(this, arguments);
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
require('./hook')(generateShim);
