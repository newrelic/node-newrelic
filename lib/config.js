var events = require('events');
var fs = require('fs');
var path = require('path');
var util = require('util');

var DEFAULT_CONFIG = require('./config.default');    
    
function merge(defaults, config) {    
    Object.keys(defaults).forEach(function(name) {
        if (config[name] != undefined) {
            if (Array.isArray(config[name])) {
                // use the value in config
            } else if (typeof(defaults[name]) == 'object') {
                merge(defaults[name], config[name]);
            }
            // else use the value in config
        } else {
            config[name] = defaults[name];
        }
    }); 
}

function setDefaults(config) {
    merge(DEFAULT_CONFIG, config);
}

function parseVersion() {
    var name = __dirname + '/../package.json';
    var packageJson = JSON.parse(fs.readFileSync(name));
    return packageJson.version;
}

function initialize(logger, c) {
    var nrHome = process.env.NEWRELIC_HOME;    
    var config;
    if (typeof(c) == 'object') {
        config = c;
    } else {
        var configFileName = process.cwd() + "/newrelic.js";        
        try {
            config = require(configFileName);
        } catch (e) {
            if (nrHome) {
                configFileName = nrHome + "newrelic.js";
                config = require(configFileName);
            } else {
                throw new Error("Unable to find configuration file '" + configFileName + 
                		"'  A default configuration file can be copied from '" +
                		__dirname + "/config.default.js'.");
            }
        }
        logger.debug("Using configuration file " + configFileName);
    }
    
    setDefaults(config);
    
    config = config['config'];
    config['newrelic_home'] = nrHome;
    
    return new Config(config);
}


function Config(config) { 
    events.EventEmitter.call(this);
    var self = this;
    for (var name in config) { this[name] = config[name]; };
    
    var version = parseVersion();    
    this.getVersion = function() {
        return version;
    };
    
    var transactionTracerConfig = new TransactionTracerConfig(this['transaction_tracer']);
    this.getTransactionTracerConfig = function() {
        return transactionTracerConfig;
    };   
    
    this.onConnect = function(params) {
        self['apdex_t'] = params['apdex_t'];
        if (self['apdex_t']) {
            transactionTracerConfig = new TransactionTracerConfig(this['transaction_tracer'], self['apdex_t']);
        }
        self.emit('change', self);
    };
}
util.inherits(Config, events.EventEmitter);

Config.prototype.getApplications = function() {
    var apps = this['app_name'];
    if (apps && typeof(apps) == 'string') {
        return [apps];
    }
    return apps;
};

Config.prototype.getLogLevel = function() {
    var level = this['log_level'];
    if (!level) {
        return 'info';
    }
    return level;
};

Config.prototype.getPort = function() {
    // FIXME https support
    return this['port'];
};

function TransactionTracerConfig(config, apdexT) {
    for (var name in config) { this[name] = config[name]; };
    
    var traceThreshold = this['trace_threshold'];
    if (traceThreshold == 'apdex_f') {
        traceThreshold = apdexT ? apdexT * 4 : 2.0;
    }
    
    this.getTraceThresholdInMillis = function() {
        return traceThreshold * 1000;
    };
}

exports.initialize = initialize;