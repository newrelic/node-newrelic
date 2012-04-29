var events = require('events')
  , util   = require('util')
  ;

var DEFAULT_CONFIG = require('./config.default');

function merge(defaults, config) {
  Object.keys(defaults).forEach(function (name) {
    if (config[name] !== undefined) {
      if (Array.isArray(config[name])) {
        // use the value in config
      }
      else if (typeof(defaults[name]) === 'object') {
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
  require('pkginfo')(info, 'version');
  return info.exports.version;
}

function TransactionTracerConfig(config, apdexT) {
  for (var name in config) {
    if (config.hasOwnProperty(name)) {
      this[name] = config[name];
    }
  }

  var traceThreshold = this.trace_threshold;
  if (traceThreshold === 'apdex_f') {
    traceThreshold = apdexT ? apdexT * 4 : 2.0;
  }

  this.traceThresholdInMillis = traceThreshold * 1000;
}

function Config(config) {
  events.EventEmitter.call(this);

  for (var name in config) {
    if (config.hasOwnProperty(name)) {
      this[name] = config[name];
    }
  }

  this.version = parseVersion();

  this.transactionTracerConfig = new TransactionTracerConfig(this.transaction_tracer);

  this.onConnect = function (params) {
    this.apdex_t = params.apdex_t;
    if (this.apdex_t) this.transactionTracerConfig = new TransactionTracerConfig(this.transaction_tracer, this.apdex_t);

    this.emit('change', this);
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

function initialize(logger, c) {
  var nrHome = process.env.NEWRELIC_HOME;
  var config;
  if (typeof(c) === 'object') {
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

exports.initialize = initialize;
