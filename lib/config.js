'use strict'

var util         = require('util')
  , path         = require('path')
  , fs           = require('fs')
  , EventEmitter = require('events').EventEmitter
  , logger
  , NAMES        = require('./metrics/names.js')
  , feature_flag = require('./feature_flags.js')
  , flatten      = require('./util/flatten')
  , hashes       = require('./util/hashes')
  , exists       = fs.existsSync || path.existsSync

/**
 * CONSTANTS -- we gotta lotta 'em
 */
var DEFAULT_CONFIG_PATH = path.join(__dirname, 'config.default.js')
var DEFAULT_CONFIG = require(DEFAULT_CONFIG_PATH).config
var DEFAULT_FILENAME = 'newrelic.js'
var AZURE_APP_NAME = 'APP_POOL_ID'
var CONFIG_FILE_LOCATIONS = [
  process.env.NEW_RELIC_HOME,
  process.cwd(),
  process.env.HOME,
  path.join(__dirname, '../../..') // above node_modules
]

// the REPL has no main module
if (process.mainModule && process.mainModule.filename) {
  CONFIG_FILE_LOCATIONS.splice(2, 0, path.dirname(process.mainModule.filename))
}

/*
 * ENV_MAPPING, LIST_VARS, and BOOLEAN_VARS could probably be unified and
 * objectified, but this is simple and works.
 */
var ENV_MAPPING = {
  newrelic_home               : "NEW_RELIC_HOME",
  app_name                    : "NEW_RELIC_APP_NAME",
  license_key                 : "NEW_RELIC_LICENSE_KEY",
  ssl                         : "NEW_RELIC_USE_SSL",
  host                        : "NEW_RELIC_HOST",
  port                        : "NEW_RELIC_PORT",
  proxy                       : "NEW_RELIC_PROXY_URL",
  proxy_host                  : "NEW_RELIC_PROXY_HOST",
  proxy_port                  : "NEW_RELIC_PROXY_PORT",
  proxy_user                  : "NEW_RELIC_PROXY_USER",
  proxy_pass                  : "NEW_RELIC_PROXY_PASS",
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
  enforce_backstop            : "NEW_RELIC_ENFORCE_BACKSTOP",
  browser_monitoring: {
    enable : "NEW_RELIC_BROWSER_MONITOR_ENABLE",
    debug  : "NEW_RELIC_BROWSER_MONITOR_DEBUG"
  },
  high_security: "NEW_RELIC_HIGH_SECURITY",
  labels: "NEW_RELIC_LABELS"
}

// values in list variables are comma-delimited lists
var LIST_VARS = [
  "NEW_RELIC_APP_NAME",
  "NEW_RELIC_IGNORED_PARAMS",
  "NEW_RELIC_ERROR_COLLECTOR_IGNORE_ERROR_CODES",
  "NEW_RELIC_IGNORING_RULES"
]

// values in object lists are comma-delimited object literals
var OBJECT_LIST_VARS = [
  "NEW_RELIC_NAMING_RULES"
]

var HAS_ARBITRARY_KEYS = [
  'labels'
]

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
  "NEW_RELIC_ENFORCE_BACKSTOP",
  "NEW_RELIC_USE_SSL",
  "NEW_RELIC_BROWSER_MONITOR_ENABLE",
  "NEW_RELIC_BROWSER_MONITOR_DEBUG",
  "NEW_RELIC_HIGH_SECURITY"
]

// Config keys that can't be set by the server if high_security === true
var HIGH_SECURITY_SETTINGS = {
  ssl: true,
  capture_params: false
}
var HIGH_SECURITY_KEYS = Object.keys(HIGH_SECURITY_SETTINGS)

// blank out these config values before sending to the collector
var REDACT_BEFORE_SEND = ['proxy_pass', 'proxy_user', 'proxy']

function isTruthular(setting) {
  if (setting === undefined || setting === null) return false

  var normalized = setting.toString().toLowerCase()
  switch (normalized) {
    case 'false':
    case 'f':
    case 'no':
    case 'n':
    case 'disabled':
    case '0':
      return false

    default:
      return true
  }
}

function fromObjectList(setting) {
  try {
    return JSON.parse('[' + setting + ']')
  }
  catch (error) {
    logger.error("New Relic configurator could not deserialize object list:")
    logger.error(error.stack)
  }
}

function _findConfigFile() {
  var candidate
    , filepath


  for (var i = 0; i < CONFIG_FILE_LOCATIONS.length; i++) {
    candidate = CONFIG_FILE_LOCATIONS[i]
    if (!candidate) continue

    filepath = path.join(path.resolve(candidate), DEFAULT_FILENAME)
    if (!exists(filepath)) continue

    return fs.realpathSync(filepath)
  }
}

function _failHard() {
  var mainpath = path.resolve(path.join(process.cwd(), DEFAULT_FILENAME))
    , altpath  = path.resolve(path.dirname(process.mainModule.filename),
                              DEFAULT_FILENAME)


  var locations
  if (mainpath !== altpath) {
    locations = mainpath + " or\n" + altpath
  }
  else {
    locations = mainpath
  }

  throw new Error(
    "Unable to find New Relic module configuration. A default\n" +
    "configuration file can be copied from " + DEFAULT_CONFIG_PATH + "\n" +
    "and put at " + locations + "."
  )
}

function Config(config) {
  EventEmitter.call(this)

  // 1. start by cloning the defaults
  var basis = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
  Object.keys(basis).forEach(function cb_forEach(key) {
    this[key] = basis[key]
  }, this)

  // 2. initialize undocumented, internal-only default values

  // feature flags are mostly private settings for gating unreleased features
  // flags are set in the feature_flags.js file
  this.feature_flag = feature_flag.prerelease

  // set by environment
  this.newrelic_home = null
  // set by configuration file loader
  this.config_file_path = null
  // set by collector on handshake
  this.run_id = null
  this.application_id = null
  this.web_transactions_apdex = {}
  this.cross_process_id = null
  this.encoding_key = null
  this.obfuscatedId = null
  this.trusted_account_ids = null

  // how frequently harvester runs
  this.data_report_period = 60

  // based on max call stack depth
  this.max_trace_segments = 900

  // feature level of this account
  this.product_level = 0
  // product-level related
  this.collect_traces = true
  this.collect_errors = true

  this.browser_monitoring.loader = 'rum'
  this.browser_monitoring.loader_version = ''

  this.custom_insights_events = {
    enabled: true,
    max_samples_stored: 10000
  }

  // TODO: currently does not support this, but high-security mode requires
  // that we explicitly state how we handle this feature
  this.transaction_tracer.record_sql = 'off'

  // 3. override defaults with values from the loaded / passed configuration
  this._fromPassed(config)

  // 3.5. special values (only Azure environment APP_POOL_ID for now)
  this._fromSpecial()

  // 4. override config with environment variables
  this._fromEnvironment()

  // 5. clean up anything that requires postprocessing
  this._canonicalize()

  // 6. put the version in the config
  this.version = require('../package.json').version

  // 7. apply high security overrides
  if (this.high_security === true) {
    this._applyHighSecurity()
  }
}
util.inherits(Config, EventEmitter)

/**
 * Because this module and logger depend on each other, the logger needs
 * a way to inject the actual logger instance once it's constructed.
 * It's kind of a Rube Goldberg device, but it works.
 *
 * @param {Logger} bootstrapped The actual, configured logger.
 */
Config.prototype.setLogger = function setLogger(bootstrapped) {
  logger = bootstrapped
}

/**
 * Accept any configuration passed back from the server. Will log all
 * recognized, unsupported, and unknown parameters. Some may not be set,
 * depending on the setting of ignore_server_configuration.
 *
 * @param {object} json The config blob sent by New Relic.
 */
Config.prototype.onConnect = function onConnect(json, recursion) {
  json = json || {}
  if (this.high_security === true && recursion !== true && json.high_security !== true) {
    this.agent_enabled = false
    this.emit('agent_enabled', false)
    return
  }
  if (Object.keys(json).length === 0) return

  Object.keys(json).forEach(function cb_forEach(key) {
    this._fromServer(json, key)
  }, this)

  this.emit('change', this)
}

/**
 * The guts of the logic about how to deal with server-side configuration.
 *
 * @param {object} params A configuration dictionary.
 * @param {string} key    The particular configuration parameter to set.
 */
Config.prototype._fromServer = function _fromServer(params, key) {
  switch (key) {
    // handled by the connection
    case 'messages':
      break

    // *sigh* Xzibit, etc.
    case 'agent_config':
      this.onConnect(params[key], true)
      break

    // if it's undefined or null, so be it
    case 'agent_run_id':
      this.run_id = params.agent_run_id
      break

    // handled by config.onConnect
    case 'high_security':
      break

    // always accept these settings
    case 'cross_process_id':
    case 'encoding_key':
      this._alwaysUpdateIfChanged(params, key)
      if (this.cross_process_id && this.encoding_key) {
        this.obfuscatedId = hashes.obfuscateNameUsingKey(this.cross_process_id,
                                                         this.encoding_key)
      }
      break

    // always accept these settings
    case 'collect_traces':
    case 'collect_errors':
    case 'product_level':
    case 'application_id':
    case 'trusted_account_ids':
      this._alwaysUpdateIfChanged(params, key)
      break

    // also accept these settings
    case 'url_rules':
    case 'metric_name_rules':
    case 'transaction_name_rules':
    case 'transaction_segment_terms':
      this._emitIfSet(params, key)
      break

    // setting these can be disabled by ignore_server_configuration
    case 'ssl':
    case 'apdex_t':
    case 'web_transactions_apdex':
    case 'data_report_period':
    case 'capture_params':
    case 'ignored_params':
      this._updateIfChanged(params, key)
      break
    case 'transaction_tracer.enabled':
      this._updateNestedIfChanged(
        params,
        this.transaction_tracer,
        'transaction_tracer.enabled',
        'enabled'
      )
      break
    case 'transaction_tracer.transaction_threshold':
      this._updateNestedIfChanged(
        params,
        this.transaction_tracer,
        'transaction_tracer.transaction_threshold',
        'transaction_threshold'
      )
      break
    case 'error_collector.enabled':
      this._updateNestedIfChanged(
        params,
        this.error_collector,
        'error_collector.enabled',
        'enabled'
      )
      break
    case 'error_collector.ignore_status_codes':
      this._updateNestedIfChanged(
        params,
        this.error_collector,
        'error_collector.ignore_status_codes',
        'ignore_status_codes'
      )
      this._canonicalize()
      break

    case 'collect_analytics_events':
      // never enable from server-side
      // but we allow the server to disable
      if (params.collect_analytics_events === false)
        this.transaction_events.enabled = false
      break

    case 'transaction_events.max_samples_stored':
      this._updateNestedIfChanged(
        params,
        this.transaction_events,
        key,
        'max_samples_stored'
      )
      break

    case 'transaction_events.max_samples_per_minute':
      this._updateNestedIfChanged(
        params,
        this.transaction_events,
        key,
        'max_samples_per_minute'
      )
      break

    case 'transaction_events.enabled':
      this._updateNestedIfChanged(
        params,
        this.transaction_events,
        key,
        'enabled'
      )
      break

    // these are used by browser_monitoring
    // and the api.getRUMHeader() method
    case 'js_agent_file':
    case 'js_agent_loader_file':
    case 'beacon':
    case 'error_beacon':
    case 'browser_key':
    case 'js_agent_loader':
      this._updateNestedIfChangedRaw(
        params,
        this.browser_monitoring,
        key,
        key
      )
      break

    case 'browser_monitoring.loader':
      this._updateNestedIfChangedRaw(
        params,
        this.browser_monitoring,
        key,
        'loader'
      )
      break

    // these settings aren't supported by the agent (yet)
    case 'sampling_rate':
    case 'episodes_file':
    case 'episodes_url':
    case 'cross_application_tracing':
    case 'transaction_tracer.record_sql':
    case 'slow_sql.enabled':
    case 'rum.load_episodes_file':
      this.logUnsupported(params, key)
      break

    default:
      this.logUnknown(params, key)
  }
}

/**
 * Change a value sent by the collector if and only if it's different from the
 * value we already have. Emit an event with the key name and the new value,
 * and log that the value has changed.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value we're looking to set.
 */
Config.prototype._alwaysUpdateIfChanged = function _alwaysUpdateIfChanged(json, key) {
  var value = json[key]
  if (value !== null && value !== undefined && this[key] !== value) {
    if (Array.isArray(value) && Array.isArray(this[key])) {
      value.forEach(function cb_forEach(element) {
        if (this[key].indexOf(element) === -1) this[key].push(element)
      }, this)
    }
    else {
      this[key] = value
    }
    this.emit(key, value)
    logger.debug("Configuration of %s was changed to %s by New Relic.", key, value)
  }
}

/**
 * Change a value sent by the collector if and only if it's different from the
 * value we already have. Emit an event with the key name and the new value,
 * and log that the value has changed. Parameter will be ignored if
 * ignore_server_configuration is set.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value we're looking to set.
 */
Config.prototype._updateIfChanged = function _updateIfChanged(json, key) {
  this._updateNestedIfChanged(json, this, key, key)
}

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
Config.prototype._updateNestedIfChanged = function _updateNestedIfChanged(remote, local, remoteKey, localKey) {
  if (this.ignore_server_configuration) return this.logDisabled(remote, remoteKey)
  // if high-sec mode is enabled, we do not accept server changes to high-sec
  if (this.high_security && HIGH_SECURITY_KEYS.indexOf(localKey) !== -1) {
    return this.logDisabled(remote, remoteKey)
  }
  else return this._updateNestedIfChangedRaw(remote, local, remoteKey, localKey)
}

Config.prototype._updateNestedIfChangedRaw = function _updateNestedIfChangedRaw(
    remote, local, remoteKey, localKey) {
  var value = remote[remoteKey]
  if (value !== null && value !== undefined && local[localKey] !== value) {
    if (Array.isArray(value) && Array.isArray(local[localKey])) {
      value.forEach(function cb_forEach(element) {
        if (local[localKey].indexOf(element) === -1) local[localKey].push(element)
      })
    }
    else {
      local[localKey] = value
    }
    this.emit(remoteKey, value)
    logger.debug("Configuration of %s was changed to %s by New Relic.", remoteKey, value)
  }
}

/**
 * Some parameter values are just to be passed on.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value we're looking to set.
 */
Config.prototype._emitIfSet = function _emitIfSet(json, key) {
  var value = json[key]
  if (value !== null && value !== undefined) this.emit(key, value)
}

/**
 * The agent would normally do something with this parameter, but server-side
 * configuration is disabled via ignore_server_configuration.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value the agent won't set.
 */
Config.prototype.logDisabled = function logDisabled(json, key) {
  var value = json[key]
  if (value !== null && value !== undefined) {
    logger.debug(
      "Server-side configuration of %s is currently disabled by local configuration. " +
      "(Server sent value of %s.)",
      key,
      value
    )
  }
}

/**
 * Help support out by putting in the logs the fact that we don't currently
 * support the provided configuration key, and including the sent value.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value the agent doesn't set.
 */
Config.prototype.logUnsupported = function logUnsupported(json, key) {
  var flavor
  if (this.ignore_server_configuration) {
    flavor = "ignored"
  }
  else {
    flavor = "not supported by the Node.js agent"
  }

  var value = json[key]
  if (value !== null && value !== undefined) {
    logger.debug(
      "Server-side configuration of %s is currently %s. (Server sent value of %s.)",
      key,
      flavor,
      value
    )
    this.emit(key, value)
  }
}

/**
 * The agent knows nothing about this parameter.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value the agent knows nothing about.
 */
Config.prototype.logUnknown = function logUnknown(json, key) {
  var value = json[key]
  logger.debug(
    "New Relic sent unknown configuration parameter %s with value %s.",
    key,
    value
  )
}

/**
 * Ensure that the apps names are always returned as a list.
 */
Config.prototype.applications = function applications() {
  var apps = this.app_name

  if (Array.isArray(apps) && apps.length > 0) {
    return apps
  }
  if (apps && typeof apps === 'string') {
    return [apps]
  }
  else {
    return []
  }
}

/**
 * Safely overwrite defaults with values passed to constructor.
 *
 * @param object external The configuration being loaded.
 * @param object internal Whichever chunk of the config being overridden.
 */
Config.prototype._fromPassed = function _fromPassed(external, internal, arbitrary) {
  if (!external) return
  if (!internal) internal = this

  Object.keys(external).forEach(function cb_forEach(key) {
    // if it's not in the defaults, it doesn't exist
    if (!arbitrary && internal[key] === undefined) return

    var node = external[key]

    if (Array.isArray(node)) {
      internal[key] = node
    } else if (typeof node === 'object') {
      // is top level and can have arbitrary keys
      if (internal === this && HAS_ARBITRARY_KEYS.indexOf(key) !== -1) {
        this._fromPassed(node, internal[key], true)
      } else {
        this._fromPassed(node, internal[key], false)
      }
    } else {
      internal[key] = node
    }
  }, this)
}

/**
 * Some values should be picked up only if they're not otherwise set, like
 * the Windows / Azure application name. Don't set it if there's already
 * a non-empty value set via the configuration file, and allow these
 * values to be overwritten by environment variables. Just saves a step for
 * PaaS users who don't want to have multiple settings for a single piece
 * of configuration.
 */
Config.prototype._fromSpecial = function _fromSpecial() {
  var name = this.app_name
  if (name === null || name === undefined || name === '' ||
      (Array.isArray(name) && name.length === 0)) {
    var azureName = process.env[AZURE_APP_NAME]
    if (azureName) this.app_name = azureName.split(',')
  }
}

/**
 * Recursively visit the nodes of the constant containing the mapping between
 * environment variable names, overriding any configuration values that are
 * found in the environment. Operates purely via side effects.
 *
 * @param object metadata The current level of the mapping object. Should never
 *                        need to set this yourself.
 * @param object data     The current level of the configuration object. Should
 *                        never need to set this yourself.
 */
Config.prototype._fromEnvironment = function _fromEnvironment(metadata, data) {
  if (!metadata) metadata = ENV_MAPPING
  if (!data) data = this

  Object.keys(metadata).forEach(function cb_forEach(value) {
    // if it's not in the config, it doesn't exist
    if (data[value] === undefined) return

    var node = metadata[value]
    if (typeof node === 'string') {
      var setting = process.env[node]
      if (setting) {
        if (LIST_VARS.indexOf(node) > -1) {
          data[value] = setting.split(',').map(function cb_map(k) { return k.trim() })
        } else if (OBJECT_LIST_VARS.indexOf(node) > -1) {
          data[value] = fromObjectList(setting)
        } else if (BOOLEAN_VARS.indexOf(node) > -1) {
          data[value] = isTruthular(setting)
        } else {
          data[value] = setting
        }
      }
    }
    else {
      // don't crash if the mapping has config keys the current config doesn't.
      if (!data[value]) data[value] = {}
      this._fromEnvironment(node, data[value])
    }
  }, this)
}

/**
 * Depending on how the status codes are set, they could be strings, which
 * makes strict equality testing / indexOf fail. To keep things cheap, parse
 * them once, after configuration has finished loading. Other one-off shims
 * based on special properties of configuration values should go here as well.
 */
Config.prototype._canonicalize = function _canonicalize() {
  var codes = this.error_collector && this.error_collector.ignore_status_codes
  if (codes) {
    this.error_collector.ignore_status_codes = codes.map(function cb_map(code) {
      return parseInt(code, 10)
    })
  }
}

/**
 * This goes through the settings that high security mode needs and coerces
 * them to be correct.
 */
Config.prototype._applyHighSecurity = function() {
  var self = this
  HIGH_SECURITY_KEYS.forEach(function (key) {
    var hsValue = HIGH_SECURITY_SETTINGS[key]
    if (self[key] !== hsValue) {
      logger.warn('High Security Mode: %s was set to %s, coercing to %s',
                  key, self[key], hsValue)
      self[key] = hsValue
      self.emit(key, hsValue)
    }
  })
}

/**
 * The agent will use the supportability metrics object if it's
 * available.
 *
 * @param string suffix Supportability metric name.
 * @param number duration Milliseconds that the measured operation took.
 */
Config.prototype.measureInternal = function measureInternal(suffix, duration) {
  if (this.debug.supportability) {
    var internal = this.debug.supportability
    internal.measureMilliseconds(NAMES.SUPPORTABILITY.PREFIX + suffix, null, duration)
  }
}

Config.prototype.validateFlags = function validateFlags() {
  Object.keys(this.feature_flag).forEach(function cb_forEach(key) {
    if (feature_flag.released.indexOf(key) > -1)
      logger.warn('Feature flag ' + key + ' has been released')
    if (feature_flag.unreleased.indexOf(key) > -1)
      logger.warn('Feature flag ' + key + ' has been deprecated')
  })
}

/**
 * Get a JSONifiable object containing all settings we want to report to the
 * collector and store in the environment_values table.
 *
 * @return Object containing simple key-value pairs of settings
 */
Config.prototype.publicSettings = function publicSettings () {
  var settings = {}

  for (var key in this) {
    if (this.hasOwnProperty(key)) {
      var item = this[key]

      if (REDACT_BEFORE_SEND.indexOf(key) > -1) {
        item = '****'
      }

      settings[key] = item
    }
  }

  // Agent-side setting is 'enable', but collector-side setting is
  // 'auto_instrument'. Send both values up.
  settings.browser_monitoring.auto_instrument = settings.browser_monitoring.enable

  // Remove simple circular references
  settings = JSON.parse(JSON.stringify(settings))

  settings = flatten({}, '', settings)

  return settings
}

/**
 * Create a configuration, either from a configuration file or the node
 * process's environment.
 *
 * For configuration via file, check these directories, in order, for a
 * file named 'newrelic.js':
 *
 *   1. The process's current working directory at startup.
 *   2. The same directory as the process's main module (i.e. the filename
 *      passed to node on the command line).
 *   3. The directory pointed to by the environment variable NEW_RELIC_HOME.
 *   4. The current process's HOME directory.
 *   5. If this module is installed as a dependency, the directory above the
 *      node_modules folder in which newrelic is installed.
 *
 * For configration via environment (useful on Joyent, Azure, Heroku, or
 * other PaaS offerings), set NEW_RELIC_NO_CONFIG_FILE to something truthy
 * and read README.md for details on what configuration variables are
 * necessary, as well as a complete enumeration of the other available
 * variables.
 *
 * @param {object} config Optional configuration to be used in place of a
 *                        config file.
 */
function initialize(config) {
  /* When the logger is required here, it bootstraps itself and then
   * injects itself into this module's closure via setLogger on the
   * instance of the logger it creates.
   */
  logger = require('./logger.js')

  if (config) return new Config(config)

  if (isTruthular(process.env.NEW_RELIC_NO_CONFIG_FILE)) {
    config = new Config({})
    if (config.newrelic_home) delete config.newrelic_home
    return config
  }

  var filepath = _findConfigFile()
  if (!filepath) return _failHard()

  try {
    config = new Config(require(filepath).config)
    config.config_file_path = filepath
    logger.debug("Using configuration file %s.", filepath)

    config.validateFlags()

    return config
  }
  catch (error) {
    throw new Error(
      "Unable to read configuration file " + filepath + ". A default\n" +
      "configuration file can be copied from " + DEFAULT_CONFIG_PATH + "\n" +
      "and renamed to 'newrelic.js' in the directory from which you'll be starting\n" +
      "your application."
    )
  }
}

/**
 * Preserve the legacy initializer, but also allow consumers to manage their
 * own configuration if they choose.
 */
Config.initialize = initialize

module.exports = Config
