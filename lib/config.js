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
  newrelic_home               : "NEW_RELIC_HOME",
  app_name                    : "NEW_RELIC_APP_NAME",
  license_key                 : "NEW_RELIC_LICENSE_KEY",
  host                        : "NEW_RELIC_HOST",
  port                        : "NEW_RELIC_PORT",
  proxy_host                  : "NEW_RELIC_PROXY_HOST",
  proxy_port                  : "NEW_RELIC_PROXY_PORT",
  ignore_server_configuration : "NEW_RELIC_IGNORE_SERVER_CONFIGURATION",
  agent_enabled               : "NEW_RELIC_ENABLED",
  apdex_t                     : "NEW_RELIC_APDEX",
  capture_params              : "NEW_RELIC_CAPTURE_PARAMS",
  ignored_params              : "NEW_RELIC_IGNORED_PARAMS",
  logging                     : {
    level    : "NEW_RELIC_LOG_LEVEL",
    filepath : "NEW_RELIC_LOG"
  },
  error_collector             : {
    enabled             : "NEW_RELIC_ERROR_COLLECTOR_ENABLED",
    ignore_status_codes : "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES"
  },
  transaction_tracer          : {
    enabled               : "NEW_RELIC_TRACER_ENABLED",
    transaction_threshold : "NEW_RELIC_TRACER_THRESHOLD",
    top_n                 : "NEW_RELIC_TRACER_TOP_N"
  },
  debug                       : {
    internal_metrics : "NEW_RELIC_DEBUG_METRICS",
    tracer_tracing   : "NEW_RELIC_DEBUG_TRACER"
  },
  rules                       : {
    name   : "NEW_RELIC_NAMING_RULES",
    ignore : "NEW_RELIC_IGNORING_RULES"
  },
  enforce_backstop            : "NEW_RELIC_ENFORCE_BACKSTOP"
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
  "NEW_RELIC_IGNORE_SERVER_CONFIGURATION",
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
  this.application_id = null;   // set by collector on handshake
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
 * Accept any configuration passed back from the server. Will log all
 * recognized, unsupported, and unknown parameters. Some may not be set,
 * depending on the setting of ignore_server_configuration.
 *
 * @param {object} json The config blob sent by New Relic.
 */
Config.prototype.onConnect = function (json) {
  if (!json || Object.keys(json).length === 0) return;
  Object.keys(json).forEach(function (key) {
    this._fromServer(json, key);
  }, this);

  this.emit('change', this);
};

/**
 * The guts of the logic about how to deal with server-side configuration.
 *
 * @param {object} params A configuration dictionary.
 * @param {string} key    The particular configuration parameter to set.
 */
Config.prototype._fromServer = function (params, key) {
  switch (key) {
    // handled by the connection
    case 'messages':
      break;

    // if it's undefined or null, so be it
    case 'agent_run_id':
      this.run_id = params.agent_run_id;
      break;

    // always accept these settings
    case 'collect_traces':
    case 'collect_errors':
    case 'product_level':
    case 'application_id':
      this._alwaysUpdateIfChanged(params, key);
      break;

    // also accept these settings
    case 'url_rules':
    case 'metric_name_rules':
    case 'transaction_name_rules':
      this._emitIfSet(params, key);
      break;

    // setting these can be disabled by ignore_server_configuration
    case 'apdex_t':
    case 'data_report_period':
    case 'capture_params':
    case 'ignored_params':
      this._updateIfChanged(params, key);
      break;
    case 'transaction_tracer.enabled':
      this._updateNestedIfChanged(
        params,
        this.transaction_tracer,
        'transaction_tracer.enabled',
        'enabled'
      );
      break;
    case 'transaction_tracer.transaction_threshold':
      this._updateNestedIfChanged(
        params,
        this.transaction_tracer,
        'transaction_tracer.transaction_threshold',
        'transaction_threshold'
      );
      break;
    case 'error_collector.enabled':
      this._updateNestedIfChanged(
        params,
        this.error_collector,
        'error_collector.enabled',
        'enabled'
      );
      break;

    // these settings aren't supported by the agent (yet)
    case 'sampling_rate':
    case 'beacon':
    case 'error_beacon':
    case 'js_agent_file':
    case 'js_agent_loader_file':
    case 'episodes_file':
    case 'episodes_url':
    case 'cross_process_id':
    case 'cross_application_tracing':
    case 'encoding_key':
    case 'browser_key':
    case 'trusted_account_ids':
    case 'high_security':
    case 'ssl':
    case 'transaction_tracer.record_sql':
    case 'slow_sql.enabled':
    case 'rum.load_episodes_file':
      this.logUnsupported(params, key);
      break;

    default:
      this.logUnknown(params, key);
  }
};

/**
 * Change a value sent by the collector if and only if it's different from the
 * value we already have. Emit an event with the key name and the new value,
 * and log that the value has changed.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value we're looking to set.
 */
Config.prototype._alwaysUpdateIfChanged = function (json, key) {
  var value = json[key];
  if (value !== null && value !== undefined && this[key] !== value) {
    if (Array.isArray(value) && Array.isArray(this[key])) {
      value.forEach(function (element) {
        if (this[key].indexOf(element) === -1) this[key].push(element);
      }, this);
    }
    else {
      this[key] = value;
    }
    this.emit(key, value);
    logger.info("Configuration of %s was changed to %s by New Relic.", key, value);
  }
};

/**
 * Change a value sent by the collector if and only if it's different from the
 * value we already have. Emit an event with the key name and the new value,
 * and log that the value has changed. Parameter will be ignored if
 * ignore_server_configuration is set.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value we're looking to set.
 */
Config.prototype._updateIfChanged = function (json, key) {
  this._updateNestedIfChanged(json, this, key, key);
};

/**
 * Some parameter values are nested, need a simple way to change them as well.
 * Will merge local and remote if and only if both are arrays. Parameter will
 * be ignored if ignore_server_configuration is set.
 *
 * @param {object} remote    JSON sent from New Relic.
 * @param {object} local     A portion of this configuration object.
 * @param {string} remoteKey The name sent by New Relic.
 * @param {string} localKey  The local name.
 */
Config.prototype._updateNestedIfChanged = function (remote, local, remoteKey, localKey) {
  if (this.ignore_server_configuration) return this.logDisabled(remote, remoteKey);

  var value = remote[remoteKey];
  if (value !== null && value !== undefined && local[localKey] !== value) {
    if (Array.isArray(value) && Array.isArray(local[localKey])) {
      value.forEach(function (element) {
        if (local[localKey].indexOf(element) === -1) local[localKey].push(element);
      });
    }
    else {
      local[localKey] = value;
    }
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
 * The agent would normally do something with this parameter, but server-side
 * configuration is disabled via ignore_server_configuration.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value the agent won't set.
 */
Config.prototype.logDisabled = function (json, key) {
  var value = json[key];
  if (value !== null && value !== undefined) {
    logger.debug(
      "Server-side configuration of %s is currently disabled by local configuration. " +
      "(Server sent value of %j.)",
      key,
      value
    );
    this.emit(key, value);
  }
};

/**
 * Help support out by putting in the logs the fact that we don't currently
 * support the provided configuration key, and including the sent value.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value the agent doesn't set.
 */
Config.prototype.logUnsupported = function (json, key) {
  var flavor;
  if (this.ignore_server_configuration) {
    flavor = "ignored";
  }
  else {
    flavor = "not supported by the Node.js agent";
  }

  var value = json[key];
  if (value !== null && value !== undefined) {
    logger.debug(
      "Server-side configuration of %s is currently %s. (Server sent value of %j.)",
      key,
      flavor,
      value
    );
    this.emit(key, value);
  }
};

/**
 * The agent knows nothing about this parameter.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value the agent knows nothing about.
 */
Config.prototype.logUnknown = function (json, key) {
  var value = json[key];
  logger.debug(
    "New Relic sent unknown configuration parameter %s with value %j.",
    key,
    value
  );
};

/**
 * Ensure that the apps names are always returned as a list.
 */
Config.prototype.applications = function () {
  var apps = this.app_name;

  if (Array.isArray(apps) && apps.length > 0) {
    return apps;
  }
  if (apps && typeof apps === 'string') {
    return [apps];
  }
  else {
    return [];
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
        filepath = path.join(path.dirname(process.mainModule.filename), DEFAULT_FILENAME);
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
