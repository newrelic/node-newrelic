'use strict';

var util         = require('util')
  , path         = require('path')
  , EventEmitter = require('events').EventEmitter
  ;

/**
 * CONSTANTS -- we gotta lotta 'em
 */
var DEFAULT_CONFIG = require(path.join(__dirname, 'config.default')).config;

/*
 * ENV_MAPPING, LIST_VARS, and BOOLEAN_VARS could probably be unified and
 * objectified, but this is simple and works.
 */
var ENV_MAPPING = {
  newrelic_home      : "NEW_RELIC_HOME",
  app_name           : "NEW_RELIC_APP_NAME",
  license_key        : "NEW_RELIC_LICENSE_KEY",
  host               : "NEW_RELIC_HOST",
  port               : "NEW_RELIC_PORT",
  proxy_host         : "NEW_RELIC_PROXY_HOST",
  proxy_port         : "NEW_RELIC_PROXY_PORT",
  agent_enabled      : "NEW_RELIC_ENABLED",
  apdex_t            : "NEW_RELIC_APDEX",
  logging            : {
    level    : "NEW_RELIC_LOG_LEVEL",
    filepath : "NEW_RELIC_LOG"
  },
  error_collector    : {
    enabled             : "NEW_RELIC_ERROR_COLLECTOR_ENABLED",
    ignore_status_codes : "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES"
  },
  transaction_tracer : {
    enabled         : "NEW_RELIC_TRACER_ENABLED",
    trace_threshold : "NEW_RELIC_TRACER_THRESHOLD",
    top_n           : "NEW_RELIC_TRACER_TOP_N"
  },
  debug              : {
    internal_metrics : "NEW_RELIC_DEBUG_METRICS",
    tracer_tracing   : "NEW_RELIC_DEBUG_TRACER"
  }
};

// values in list variables are comma-delimited lists
var LIST_VARS = [
  "NEW_RELIC_APP_NAME",
  "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES"
];

/*
 * Values in boolean variables. Is pretty tolerant about values, but
 * don't get fancy and just use 'true' and 'false', everybody.
 */
var BOOLEAN_VARS = [
  "NEW_RELIC_ENABLED",
  "NEW_RELIC_ERROR_COLLECTOR_ENABLED",
  "NEW_RELIC_TRACER_ENABLED",
  "NEW_RELIC_DEBUG_METRICS",
  "NEW_RELIC_DEBUG_TRACER"
];

function isTruthular(setting) {
  if (setting === undefined || setting === null) return false;

  var normalized = setting.toString().toLowerCase();
  switch (normalized) {
    case 'false':
    case 'f':
    case 'no':
    case 'n':
    case 'disabled':
    case '0':
      return false;

    default:
      return true;
  }
}

function Config(config) {
  EventEmitter.call(this);

  // 1. start by cloning the defaults
  var basis = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  Object.keys(basis).forEach(function (key) {
    this[key] = basis[key];
  }.bind(this));

  // 2. override defaults with values from the loaded / passed configuration
  this._fromPassed(config);

  // 3. override config with environment variables
  this._fromEnvironment();

  this.version = require(path.join(__dirname, '..', 'package.json')).version;
}
util.inherits(Config, EventEmitter);

/**
 * Accept any configuration passed back from the server.
 */
Config.prototype.onConnect = function (params) {
  this.apdex_t = params.apdex_t;

  this.emit('change', this);
};

/**
 * Ensure that the apps names are always returned as a list.
 */
Config.prototype.applications = function () {
  var apps = this.app_name;

  if (apps && typeof(apps) === 'string') {
    return [apps];
  }
  else {
    return apps;
  }
};

/**
 * Safely overwrite defaults with values passed to constructor.
 *
 * @param object external The configuration being loaded.
 * @param object internal Whichever chunk of the config being overrridden.
 */
Config.prototype._fromPassed = function (external, internal) {
  if (!external) return;
  if (!internal) internal = this;

  Object.keys(external).forEach(function (key) {
    var node = external[key];
    if (typeof node === 'object') {
      // if it's not in the defaults, it doesn't exist
      if (!internal[key]) return;
      this._fromPassed(node, internal[key]);
    }
    else {
      internal[key] = node;
    }
  }.bind(this));
};

/**
 * Recursively visit the nodes of the constant containing the mapping between
 * environment variable names, overriding any configuration values that are
 * found from the environment. Operates purely via side effects.
 *
 * @param object metadata The current level of the mapping object. Should never
 *                        need to set this yourself.
 * @param object data     The current level of the configuration object. Should
 *                        never need to set this yourself.
 */
Config.prototype._fromEnvironment = function (metadata, data) {
  if (!metadata) metadata = ENV_MAPPING;
  if (!data) data = this;

  Object.keys(metadata).forEach(function (value) {
    var node = metadata[value];
    if (typeof node === 'string') {
      var setting = process.env[node];
      if (setting) {
        if (LIST_VARS.indexOf(node) > -1) {
          data[value] = setting.split(',');
        }
        else if (BOOLEAN_VARS.indexOf(node) > -1) {
          data[value] = isTruthular(setting);
        }
        else {
          data[value] = setting;
        }
      }
    }
    else {
      // don't crash if the mapping has config keys the current config doesn't.
      if (!data[value]) data[value] = {};
      this._fromEnvironment(node, data[value]);
    }
  }.bind(this));
};

/**
 * The agent will use the supportability metrics object if it's
 * available.
 *
 * @param string suffix Supportability metric name.
 * @param number duration Milliseconds that the measured operation took.
 */
Config.prototype.measureInternal = function (suffix, duration) {
  if (this.debug.supportability) {
      var internal = this.debug.supportability;
      var metric = internal.getOrCreateMetric('Supportability/' + suffix);
      metric.stats.recordValueInMillis(duration);
  }
};

/**
 * Create a configuration, either looking in the current working directory
 * or in the directory specified by the environment variable NEWRELIC_HOME.
 *
 * @param object logger A logger following the standard logging API.
 * @param object c Optional configuration to be used in place of a config file.
 */
function initialize(logger, c) {
  var NEW_RELIC_HOME    = process.env.NEW_RELIC_HOME
    , DEFAULT_FILENAME = 'newrelic.js'
    , config
    ;

  if (c && c.config) {
    config = c;
  }
  else {
    if (isTruthular(process.env.NEW_RELIC_NO_CONFIG_FILE)) {
      var envOnly = new Config({});
      if (envOnly.newrelic_home) delete envOnly.newrelic_home;
      return envOnly;
    }
    else {
      var filepath;
      if (NEW_RELIC_HOME) {
        filepath = path.join(NEW_RELIC_HOME, DEFAULT_FILENAME);
      }
      else {
        filepath = path.join(process.cwd(), DEFAULT_FILENAME);
      }

      try {
        config = require(filepath);
      }
      catch (error) {
        throw new Error("Unable to find configuration file '" + filepath +
                        "'. A default configuration file can be copied from '" +
                        path.join(__dirname, 'config.default.js') +
                        "' and renamed to 'newrelic.js' " +
                        "in the directory from which you'll be running your app.");
      }

      if (logger) logger.debug("Using configuration file %s.", filepath);
    }
  }

  return new Config(config.config);
}

/**
 * Preserve the legacy initializer, but also allow consumers to manage their
 * own configuration if they choose.
 */
Config.initialize = initialize;

module.exports = Config;
