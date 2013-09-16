'use strict';

var util         = require('util')
  , path         = require('path')
  , EventEmitter = require('events').EventEmitter
  , logger       = require(path.join(__dirname, 'logger.js'))
  , NAMES        = require(path.join(__dirname, 'metrics', 'names.js'))
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
  capture_params     : "NEW_RELIC_CAPTURE_PARAMS",
  ignored_params     : "NEW_RELIC_IGNORED_PARAMS",
  logging            : {
    level    : "NEW_RELIC_LOG_LEVEL",
    filepath : "NEW_RELIC_LOG"
  },
  error_collector    : {
    enabled             : "NEW_RELIC_ERROR_COLLECTOR_ENABLED",
    ignore_status_codes : "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES"
  },
  transaction_tracer : {
    enabled               : "NEW_RELIC_TRACER_ENABLED",
    transaction_threshold : "NEW_RELIC_TRACER_THRESHOLD",
    top_n                 : "NEW_RELIC_TRACER_TOP_N"
  },
  debug              : {
    internal_metrics : "NEW_RELIC_DEBUG_METRICS",
    tracer_tracing   : "NEW_RELIC_DEBUG_TRACER"
  },
  rules              : {
    name   : "NEW_RELIC_NAMING_RULES",
    ignore : "NEW_RELIC_IGNORING_RULES"
  },
  enforce_backstop : "NEW_RELIC_ENFORCE_BACKSTOP"
};

// values in list variables are comma-delimited lists
var LIST_VARS = [
  "NEW_RELIC_APP_NAME",
  "NEW_RELIC_IGNORED_PARAMS",
  "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES",
  "NEW_RELIC_IGNORING_RULES"
];

// values in object lists are comma-delimited object literals
var OBJECT_LIST_VARS = [
  "NEW_RELIC_NAMING_RULES"
];

/*
 * Values in boolean variables. Is pretty tolerant about values, but
 * don't get fancy and just use 'true' and 'false', everybody.
 */
var BOOLEAN_VARS = [
  "NEW_RELIC_ENABLED",
  "NEW_RELIC_CAPTURE_PARAMS",
  "NEW_RELIC_ERROR_COLLECTOR_ENABLED",
  "NEW_RELIC_TRACER_ENABLED",
  "NEW_RELIC_DEBUG_METRICS",
  "NEW_RELIC_DEBUG_TRACER",
  "NEW_RELIC_ENFORCE_BACKSTOP"
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

function fromObjectList(setting) {
  try {
    return JSON.parse('[' + setting + ']');
  }
  catch (error) {
    logger.error("New Relic configurator could not deserialize object list:");
    logger.error(error.stack);
  }
}

function Config(config) {
  EventEmitter.call(this);

  // 1. start by cloning the defaults
  var basis = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  Object.keys(basis).forEach(function (key) {
    this[key] = basis[key];
  }, this);

  // 2. initialize undocumented, internal-only default values
  this.run_id = null;           // set by collector on handshake
  this.data_report_period = 60; // how frequently harvester runs
  this.product_level = 0;       // feature level of this account
  this.collect_traces = true;   // product-level related
  this.collect_errors = true;   // product-level related

  // 3. override defaults with values from the loaded / passed configuration
  this._fromPassed(config);

  // 4. override config with environment variables
  this._fromEnvironment();

  // 5. put the version in the config
  this.version = require(path.join(__dirname, '..', 'package.json')).version;
}
util.inherits(Config, EventEmitter);

/**
 * Because this module and logger depend on one another for bootstrapping, the
 * logger module needs a way to tell this module that it's finished
 * bootstrapping and that it should switch to using the current logger. It's
 * kind of a Rube Goldberg device, but it works.
 */
Config.prototype.refreshLogger = function () {
  logger = logger.getCurrent();
};

/**
 * Accept any configuration passed back from the server.
 */
Config.prototype.onConnect = function (params) {
  this._updateIfChanged(params, 'apdex_t');
  this._updateIfChanged(params, 'data_report_period');
  this._updateIfChanged(params, 'product_level');
  this._updateIfChanged(params, 'collect_traces');
  this._updateIfChanged(params, 'collect_errors');
  this._updateIfChanged(params, 'capture_params');
  this._updateIfChanged(params, 'ignored_params');

  this._updateNestedIfChanged(
    params,
    this.transaction_tracer,
    'transaction_tracer.enabled',
    'enabled'
  );
  this._updateNestedIfChanged(
    params,
    this.transaction_tracer,
    'transaction_tracer.transaction_threshold',
    'transaction_threshold'
  );
  this._updateNestedIfChanged(
    params,
    this.error_collector,
    'error_collector.enabled',
    'enabled'
  );

  this._emitIfSet(params, 'url_rules');
  this._emitIfSet(params, 'metric_name_rules');
  this._emitIfSet(params, 'transaction_name_rules');

  this.logUnsupported(params, 'sampling_rate');
  this.logUnsupported(params, 'cross_process_id');
  this.logUnsupported(params, 'cross_application_tracing');
  this.logUnsupported(params, 'encoding_key');
  this.logUnsupported(params, 'trusted_account_ids');
  this.logUnsupported(params, 'high_security');
  this.logUnsupported(params, 'ssl');
  this.logUnsupported(params, 'transaction_tracer.record_sql');
  this.logUnsupported(params, 'slow_sql.enabled');
  this.logUnsupported(params, 'rum.load_episodes_file');

  // if it's undefined or null, so be it
  this.run_id = params.agent_run_id;

  this.emit('change', this);
};

/**
 * Change a value sent by the collector if and only if it's different from the
 * value we already have. Emit an event with the key name and the new value,
 * and log that the value has changed.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value we're looking to set.
 */
Config.prototype._updateIfChanged = function (json, key) {
  this._updateNestedIfChanged(json, this, key, key);
};

/**
 * Some parameter values are nested, need a simple way to change them as well.
 *
 * @param {object} remote    JSON sent from New Relic.
 * @param {object} local     A portion of this configuration object.
 * @param {string} remoteKey The name sent by New Relic.
 * @param {string} localKey  The local name.
 */
Config.prototype._updateNestedIfChanged = function (remote, local, remoteKey, localKey) {
  var value = remote[remoteKey];
  if (value !== null && value !== undefined && local[localKey] !== value) {
    local[localKey] = value;
    this.emit(remoteKey, value);
    logger.info("Configuration of %s was changed to %s by New Relic.", remoteKey, value);
  }
};

/**
 * Some parameter values are just to be passed on.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value we're looking to set.
 */
Config.prototype._emitIfSet = function (json, key) {
  var value = json[key];
  if (value !== null && value !== undefined) this.emit(key, value);
};

/**
 * Help support out by putting in the logs the fact that we don't currently
 * support the provided configuration key, and including the sent value. Good
 * to have.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value we can't currently set.
 */
Config.prototype.logUnsupported = function (json, key) {
  var value = json[key];
  if (value !== null && value !== undefined) {
    logger.debug(
      "Configuration of %s is currently not supported by the Node.js agent. " +
      "(Server sent value of %j.)",
      key,
      value
    );
    this.emit(key, value);
  }
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
    if (Array.isArray(node)) {
      if (!Array.isArray(internal[key])) return;
      internal[key] = internal[key].concat(node);
    }
    else if (typeof node === 'object') {
      // if it's not in the defaults, it doesn't exist
      if (!internal[key]) return;
      this._fromPassed(node, internal[key]);
    }
    else {
      internal[key] = node;
    }
  }, this);
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
        else if (OBJECT_LIST_VARS.indexOf(node) > -1) {
          data[value] = fromObjectList(setting);
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
  }, this);
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
      internal.measureMilliseconds(NAMES.SUPPORTABILITY + suffix, null, duration);
  }
};

/**
 * Create a configuration, either looking in the current working directory
 * or in the directory specified by the environment variable NEWRELIC_HOME.
 *
 * @param object logger A logger following the standard logging API.
 * @param object c Optional configuration to be used in place of a config file.
 */
function initialize(bootstrapLogger, c) {
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

      if (bootstrapLogger) {
        bootstrapLogger.debug("Using configuration file %s.", filepath);
      }
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
