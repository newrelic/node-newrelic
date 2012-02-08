var events = require('events');
var fs = require('fs');
var DEFAULT_CONFIG =
    {
      app_name: ['MyApplication'],
      host: 'collector.newrelic.com',
  
      error_collector: {
        enabled: true
      },
      
      transaction_tracer: {
        enabled: true,
        trace_threshold: 'apdex_f'
      }
    };
    
function merge(defaults, config) {    
    Object.keys(defaults).forEach(function(name) {
        if (config[name]) {
            if (typeof(defaults[name]) == 'object') {
                merge(defaults[name], config[name]);
            }
        } else {
            config[name] = defaults[name];
        }
    }); 
}

function setDefaults(config) {
    merge({'config':DEFAULT_CONFIG}, config);
}

function parseVersion() {
    var name = __dirname + '/../package.json';
    var packageJson = JSON.parse(fs.readFileSync(name));
    return packageJson.version;
}

function initialize(c) {
    var nrHome = process.env.NEWRELIC_HOME;
    if (!nrHome) {
        nrHome = '../';
    }
    var config;
    if (typeof(c) == 'object') {
        config = c;
    } else {
        config = require(nrHome + "newrelic.js");
    }
    
    setDefaults(config);
    
    config = config['config'];
    config['newrelic_home'] = nrHome;
    
    return new Config(config);
}


function Config(config) { 
    events.EventEmitter.call(this);
    var self = this;
    for (var name in config) { this[name] = config[name] };
    
    this.getApplications = function() {
        var apps = config['app_name'];
        if (apps && typeof(apps) == 'string') {
            return [apps];
        }
        return apps;
    }
    
    var version = parseVersion();    
    this.getVersion = function() {
        return version;
    }
    
    var transactionTracerConfig = new TransactionTracerConfig(this['transaction_tracer']);
    this.getTransactionTracerConfig = function() {
        return transactionTracerConfig;
    }
    
    this.onConnect = function(params) {
        self['apdex_t'] = params['apdex_t'];
        if (self['apdex_t']) {
            transactionTracerConfig = new TransactionTracerConfig(this['transaction_tracer'], self['apdex_t']);
        }
        self.emit('change', self);
    }
}

Config.super_ = events.EventEmitter;
Config.prototype = Object.create(events.EventEmitter.prototype, {
    constructor: {
        value: Config,
        enumerable: false
    }
});



function TransactionTracerConfig(config, apdexT) {
    for (var name in config) { this[name] = config[name] };
    
    var traceThreshold = this['trace_threshold'];
    if (traceThreshold == 'apdex_f') {
        traceThreshold = apdexT ? apdexT * 4 : 2.0;
    }
    
    this.getTraceThresholdInMillis = function() {
        return traceThreshold * 1000;
    }
}

exports.initialize = initialize;