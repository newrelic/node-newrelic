var events = require('events')
  , fs     = require('fs')
  , path   = require('path')
  , util   = require('util')
  ;

var DEFAULT_CONFIG = require('./config.default');

function merge(defaults, config) {
  Object.keys(defaults).forEach(function (name) {
    if (config[name] !== undefined) {
      if (Array.isArray(config[name])) {
        // use the value in config
      }
      else if (typeof(defaults[name]) == 'object') {
        merge(defaults[name], config[name]);
      }
      // else use the value in config
    }
    else {
      config[name] = defaults[name];
    }
  });
}

function setDefaults(config) {
  merge(DEFAULT_CONFIG, config);
}

function parseVersion() {
  // pkginfo wants to stick its data directly on the module's exports object, but why?
  var info = {exports : {}};
  var pkginfo = require('pkginfo')(info, 'version');
  return info.exports.version;
}

function initialize(logger, c) {
  var nrHome = process.env.NEWRELIC_HOME;
  var config;
  if (typeof(c) == 'object') {
    config = c;
  }
  else {
    var configFileName = process.cwd() + "/newrelic.js";

    try {
      config = require(configFileName);
    }
    catch (e) {
      if (nrHome) {
        configFileName = nrHome + "newrelic.js";
        config = require(configFileName);
      }
      else {
        throw new Error("Unable to find configuration file '" + configFileName +
                        "'  A default configuration file can be copied from '" +
                        __dirname + "/config.default.js'.");
      }
    }
    logger.debug("Using configuration file " + configFileName);
  }

  setDefaults(config);

  config = config.config;
  config.newrelic_home = nrHome;

  return new Config(config);
}

function Config(config) {
  events.EventEmitter.call(this);
  var self = this;
  for (var name in config) {
    self[name] = config[name];
  }

  self.version = parseVersion();

  self.transactionTracerConfig = new TransactionTracerConfig(self.transaction_tracer);

  self.onConnect = function (params) {
    self.apdex_t = params.apdex_t;
    if (self.apdex_t) transactionTracerConfig = new TransactionTracerConfig(self.transaction_tracer, self.apdex_t);

    self.emit('change', self);
  };
}
util.inherits(Config, events.EventEmitter);

Config.prototype.applications = function () {
  var apps = this.app_name;

  if (apps && typeof(apps) === 'string') {
    return [apps];
  }
  else {
    return apps;
  }
};

function TransactionTracerConfig(config, apdexT) {
  var self = this;

  for (var name in config) {
    self[name] = config[name];
  }

  var traceThreshold = self.trace_threshold;
  if (traceThreshold === 'apdex_f') {
    traceThreshold = apdexT ? apdexT * 4 : 2.0;
  }

  self.traceThresholdInMillis = traceThreshold * 1000;
}

exports.initialize = initialize;
