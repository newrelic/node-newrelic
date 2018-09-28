'use strict'

var copy = require('../util/copy')
var util = require('util')
var path = require('path')
var ERRORS = require('../collector/constants').ERRORS
var fs = require('../util/unwrapped-core').fs
var EventEmitter = require('events').EventEmitter
var AttributeFilter = require('./attribute-filter')
var feature_flag = require('../feature_flags')
var flatten = require('../util/flatten')
var hashes = require('../util/hashes')
var exists = fs.existsSync || path.existsSync
var stringify = require('json-stringify-safe')
var parseKey = require('../collector/key-parser').parseKey
var psemver = require('../util/process-version')
var os = require('os')
var logger = null // Lazy-loaded in `initialize`.


/**
 * CONSTANTS -- we gotta lotta 'em
 */
const DEFAULT_MAX_PAYLOAD_SIZE_IN_BYTES = 1000000
const DEFAULT_CONFIG_PATH = require.resolve('./default')
const DEFAULT_CONFIG = require('./default').config
const DEFAULT_FILENAME = 'newrelic.js'
const AZURE_APP_NAME = 'APP_POOL_ID'
const CONFIG_FILE_LOCATIONS = [
  process.env.NEW_RELIC_HOME,
  process.cwd(),
  process.env.HOME,
  path.join(__dirname, '../../../..') // above node_modules
]

// the REPL has no main module
if (process.mainModule && process.mainModule.filename) {
  CONFIG_FILE_LOCATIONS.splice(2, 0, path.dirname(process.mainModule.filename))
}

var HAS_ARBITRARY_KEYS = [
  'labels'
]

const LASP_MAP = require('./lasp').LASP_MAP
const ENV = require('./env')
const HSM = require('./hsm')

var _configInstance = null

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
  } catch (error) {
    logger.error("New Relic configurator could not deserialize object list:")
    logger.error(error.stack)
  }
}

function _findConfigFile() {
  var candidate
  var filepath


  for (var i = 0; i < CONFIG_FILE_LOCATIONS.length; i++) {
    candidate = CONFIG_FILE_LOCATIONS[i]
    if (!candidate) continue

    filepath = path.join(path.resolve(candidate), DEFAULT_FILENAME)
    if (!exists(filepath)) continue

    return fs.realpathSync(filepath)
  }
}

function Config(config) {
  EventEmitter.call(this)

  // 1. start by cloning the defaults
  try {
    var basis = JSON.parse(stringify(DEFAULT_CONFIG))
    Object.keys(basis).forEach(function setConfigKey(key) {
      this[key] = basis[key]
    }, this)
  } catch (err) {
    logger.warn('Unable to clone the default config, %s: %s', DEFAULT_CONFIG_PATH, err)
  }

  // 2. initialize undocumented, internal-only default values

  // feature flags are mostly private settings for gating unreleased features
  // flags are set in the feature_flags.js file
  this.feature_flag = copy.shallow(feature_flag.prerelease)

  // set by environment
  this.newrelic_home = null
  // set by configuration file loader
  this.config_file_path = null

  // set by collector on handshake
  this.run_id = null
  this.account_id = null
  this.application_id = null
  this.web_transactions_apdex = Object.create(null)
  this.cross_process_id = null
  this.encoding_key = null
  this.obfuscatedId = null
  this.primary_application_id = null
  this.trusted_account_ids = null
  this.trusted_account_key = null
  this.sampling_target = 10
  this.sampling_target_period_in_seconds = 60
  this.max_payload_size_in_bytes = DEFAULT_MAX_PAYLOAD_SIZE_IN_BYTES

  // how frequently harvester runs
  this.data_report_period = 60

  // this value is arbitrary
  this.max_trace_segments = 900

  // feature level of this account
  this.product_level = 0
  // product-level related
  this.collect_traces = true
  this.collect_errors = true

  // override options for utilization stats
  this.utilization.logical_processors = null
  this.utilization.total_ram_mib = null
  this.utilization.billing_hostname = null

  this.browser_monitoring.loader = 'rum'
  this.browser_monitoring.loader_version = ''

  // Settings to play nice with DLPs (see NODE-1044).
  this.compressed_content_encoding = "deflate"  // Deflate or gzip
  this.simple_compression = false               // Disables subcomponent compression
  this.put_for_data_send = false                // Changes http verb for harvest

  // 3. override defaults with values from the loaded / passed configuration
  this._fromPassed(config)

  // 3.5. special values (only Azure environment APP_POOL_ID for now)
  this._fromSpecial()

  // 4. override config with environment variables
  this._featureFlagsFromEnv()
  this._fromEnvironment()

  // 5. clean up anything that requires postprocessing
  this._canonicalize()

  // 6. put the version in the config
  this.version = require('../../package.json').version

  // 7. apply high security overrides
  if (this.high_security === true) {
    if (this.security_policies_token) {
      throw new Error(
        "Security Policies and High Security Mode cannot both be present " +
        "in the agent configuration. If Security Policies have been set " +
        "for your account, please ensure the security_policies_token is " +
        "set but high_security is disabled (default)."
      )
    }
    this._applyHighSecurity()
  }

  // 8. Set instance attribute filter using updated context
  this.attributeFilter = new AttributeFilter(this)
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
  json = json || Object.create(null)
  if (this.high_security === true && recursion !== true && json.high_security !== true) {
    this.agent_enabled = false
    this.emit('agent_enabled', false)
    return
  }
  if (Object.keys(json).length === 0) return

  Object.keys(json).forEach(function updateProp(key) {
    this._fromServer(json, key)
  }, this)

  this.emit('change', this)
}

Config.prototype._getMostSecure = function getMostSecure(key, currentVal, newVal) {
  var filter = LASP_MAP[key] && LASP_MAP[key].filter
  if (!this.security_policies_token || !filter) {
    // If we aren't applying something vetted by security policies we
    // just return the new value.
    return newVal
  }
  // Return the most secure if we have a filter to apply
  return filter(currentVal, newVal)
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
    case 'account_id':
    case 'application_id':
    case 'collect_errors':
    case 'collect_traces':
    case 'primary_application_id':
    case 'product_level':
    case 'max_payload_size_in_bytes':
    case 'sampling_target':
    case 'sampling_target_period_in_seconds':
    case 'trusted_account_ids':
    case 'trusted_account_key':
      this._alwaysUpdateIfChanged(params, key)
      break

    case 'collect_error_events':
      if (params.collect_error_events === false) {
        this._updateNestedIfChanged(
          params,
          this.error_collector,
          key,
          'capture_events'
        )
      }
      break

    // also accept these settings
    case 'url_rules':
    case 'metric_name_rules':
    case 'transaction_name_rules':
    case 'transaction_segment_terms':
      this._emitIfSet(params, key)
      break

    case 'ssl':
      if (!isTruthular(params.ssl)) {
        logger.warn('SSL config key can no longer be disabled, not updating.')
      }
      break

    // setting these can be disabled by ignore_server_configuration
    case 'apdex_t':
    case 'web_transactions_apdex':
    case 'data_report_period':
      this._updateIfChanged(params, key)
      break

    case 'ignored_params':
      this._updateIfChanged(params, key)
      this._canonicalize()
      break

    case 'collect_analytics_events':
      // never enable from server-side
      // but we allow the server to disable
      if (params.collect_analytics_events === false)
        this.transaction_events.enabled = false
      break

    case 'collect_custom_events':
      // never enable from server-side
      // but we allow the server to disable
      if (params.collect_custom_events === false)
        this.custom_insights_events.enabled = false
      break

    case 'allow_all_headers':
      this._updateIfChanged(params, key)
      this._canonicalize()
      break

    //
    // Browser Monitoring
    //
    case 'browser_monitoring.loader':
      this._updateNestedIfChangedRaw(
        params,
        this.browser_monitoring,
        key,
        'loader'
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

    //
    // Cross Application Tracer
    //
    case 'cross_application_tracer.enabled':
    this._updateNestedIfChanged(
      params,
      this.cross_application_tracer,
      key,
      'enabled'
    )
    break

    //
    // Error Collector
    //
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
    case 'error_collector.capture_events':
      this._updateNestedIfChanged(
        params,
        this.error_collector,
        'error_collector.capture_events',
        'capture_events'
      )
      break
    case 'error_collector.max_event_samples_stored':
      this._updateNestedIfChanged(
        params,
        this.error_collector,
        'error_collector.max_event_samples_stored',
        'max_event_samples_stored'
      )
      break

    //
    // Slow SQL
    //
    case 'slow_sql.enabled':
      this._updateNestedIfChanged(params, this.slow_sql, key, 'enabled')
      break

    //
    // Transaction Events
    //
    case 'transaction_events.enabled':
      this._updateNestedIfChanged(
        params,
        this.transaction_events,
        key,
        'enabled'
      )
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

    //
    // Transaction Tracer
    //
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

    // After 2015-02, the collector no longer supports the capture_params setting.
    case 'capture_params':
      break

    // These settings aren't supported by the agent (yet).
    case 'sampling_rate':
    case 'episodes_file':
    case 'episodes_url':
    case 'rum.load_episodes_file':
    // Ensure the most secure setting is applied to the settings below
    // when enabling them.
    case 'attributes.include_enabled':
    case 'strip_exception_messages.enabled':
    case 'transaction_tracer.record_sql':
      this.logUnsupported(params, key)
      break

    // These settings are not allowed from the server.
    case 'attributes.enabled':
    case 'attributes.exclude':
    case 'attributes.include':
    case 'browser_monitoring.attributes.enabled':
    case 'browser_monitoring.attributes.exclude':
    case 'browser_monitoring.attributes.include':
    case 'error_collector.attributes.enabled':
    case 'error_collector.attributes.exclude':
    case 'error_collector.attributes.include':
    case 'transaction_events.attributes.enabled':
    case 'transaction_events.attributes.exclude':
    case 'transaction_events.attributes.include':
    case 'transaction_tracer.attributes.enabled':
    case 'transaction_tracer.attributes.exclude':
    case 'transaction_tracer.attributes.include':
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
  if (value != null && this[key] !== value) {
    if (Array.isArray(value) && Array.isArray(this[key])) {
      value.forEach(function pushIfNew(element) {
        if (this[key].indexOf(element) === -1) this[key].push(element)
      }, this)
    } else {
      this[key] = value
    }
    this.emit(key, value)
    logger.debug('Configuration of %s was changed to %s by New Relic.', key, value)
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
Config.prototype._updateNestedIfChanged = _updateNestedIfChanged

function _updateNestedIfChanged(remote, local, remoteKey, localKey) {
  if (this.ignore_server_configuration) return this.logDisabled(remote, remoteKey)
  // if high-sec mode is enabled, we do not accept server changes to high-sec
  if (this.high_security && HSM.HIGH_SECURITY_KEYS.indexOf(remoteKey) !== -1) {
    return this.logDisabled(remote, remoteKey)
  }
  return this._updateNestedIfChangedRaw(remote, local, remoteKey, localKey)
}

Config.prototype._updateNestedIfChangedRaw = _updateNestedIfChangedRaw

function _updateNestedIfChangedRaw(remote, local, remoteKey, localKey) {
  var value = remote[remoteKey]
  if (value != null && local[localKey] !== value) {
    if (Array.isArray(value) && Array.isArray(local[localKey])) {
      value.forEach(function pushIfNew(element) {
        if (local[localKey].indexOf(element) === -1) local[localKey].push(element)
      })
    } else {
      local[localKey] = value
    }
    this.emit(remoteKey, value)
    logger.debug('Configuration of %s was changed to %s by New Relic.', remoteKey, value)
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
  if (value != null) this.emit(key, value)
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
  if (value != null) {
    logger.debug(
      'Server-side configuration of %s is currently disabled by local configuration. ' +
      '(Server sent value of %s.)',
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
  } else {
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
 * Return the availability of async_hook for use by the agent.
 */
Config.prototype.checkAsyncHookStatus = function checkAsyncHookStatus() {
  return (
    this.feature_flag.await_support &&
    (psemver.satisfies('>=8') || psemver.prerelease())
  )
}

/**
 * Gets the user set host display name. If not provided, it returns the default value.
 *
 * This function is written is this strange way becauase of the use of caching variables.
 * I wanted to cache the DisplayHost, but if I attached the variable to the config object,
 * it sends the extra variable to New Relic, which is not desired.
 *
 * @return {string} display host name
 */
Config.prototype.getDisplayHost = getDisplayHost

Config.prototype.clearDisplayHostCache = function clearDisplayHostCache() {
  this.getDisplayHost = getDisplayHost
}

function getDisplayHost() {
  var _displayHost
  this.getDisplayHost = function getCachedDisplayHost() {
    return _displayHost
  }
  if (this.process_host.display_name === '') {
    _displayHost = this.getHostnameSafe()
    return _displayHost
  }
  var stringBuffer = new Buffer(this.process_host.display_name, 'utf8')
  var numBytes = stringBuffer.length

  if (numBytes > 255) {
    logger.warn('Custom host display name must be less than 255 bytes')
    _displayHost = this.getHostnameSafe()
    return _displayHost
  }

  _displayHost = this.process_host.display_name
  return _displayHost
}

/**
 * Gets the system's host name. If that fails, it just returns ipv4/6 based on the user's
 * process_host.ipv_preferenece setting.
 *
 * This function is written is this strange way becauase of the use of caching variables.
 * I wanted to cache the Hostname, but if I attached the variable to the config object,
 * it sends the extra variable to New Relic, which is not desired.
 *
 * @return {string} host name
 */
Config.prototype.getHostnameSafe = getHostnameSafe

Config.prototype.clearHostnameCache = function clearHostnameCache() {
  this.getHostnameSafe = getHostnameSafe
}

Config.prototype.getIPAddresses = function getIPAddresses() {
  var addresses = Object.create(null)
  var interfaces = os.networkInterfaces()

  for (var interfaceKey in interfaces) {
    if (interfaceKey.match(/^lo/)) continue

    var interfaceDescriptions = interfaces[interfaceKey]
    for (var i = 0; i < interfaceDescriptions.length; i++) {
      var description = interfaceDescriptions[i]
      var family = description.family.toLowerCase()
      addresses[family] = description.address
    }
  }
  return addresses
}

function getHostnameSafe() {
  var _hostname
  this.getHostnameSafe = function getCachedHostname() {
    return _hostname
  }
  try {
    _hostname = os.hostname()
    return _hostname
  } catch (e) {
    var addresses = this.getIPAddresses()

    if (this.process_host.ipv_preference === '6' && addresses.ipv6) {
      _hostname = addresses.ipv6
    } else if (addresses.ipv4) {
      logger.info('Defaulting to ipv4 address for host name')
      _hostname = addresses.ipv4
    } else if (addresses.ipv6) {
      logger.info('Defaulting to ipv6 address for host name')
      _hostname = addresses.ipv6
    } else {
      logger.info('No hostname, ipv4, or ipv6 address found for machine')
      _hostname = 'UNKNOWN_BOX'
    }

    return _hostname
  }
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

  return []
}

/**
 * Safely overwrite defaults with values passed to constructor.
 *
 * @param {object} external The configuration being loaded.
 * @param {object} internal Whichever chunk of the config being overridden.
 */
Config.prototype._fromPassed = function _fromPassed(external, internal, arbitrary) {
  if (!external) return
  if (!internal) internal = this

  Object.keys(external).forEach(function overwrite(key) {
    // if it's not in the defaults, it doesn't exist
    if (!arbitrary && internal[key] === undefined) return

    if (key === 'ssl' && !isTruthular(external.ssl)) {
      logger.warn('SSL config key can no longer be disabled, not updating.')
      return
    }

    if (key === 'ignored_params') {
      warnDeprecated(key, 'attributes.exclude')
    }

    if (key === 'capture_params') {
      warnDeprecated(key, 'attributes.enabled')
    }

    try {
      var node = external[key]
    } catch (err) {
      logger.warn('Error thrown on access of user config for key: %s', key)
      return
    }

    if (typeof node === 'object' && !Array.isArray(node)) {
      // is top level and can have arbitrary keys
      var isTop = internal === this && HAS_ARBITRARY_KEYS.indexOf(key) !== -1
      this._fromPassed(node, internal[key], isTop)
    } else {
      internal[key] = node
    }
  }, this)

  function warnDeprecated(key, replacement) {
    logger.warn(
      'Config key %s is deprecated, please use %s instead',
      key,
      replacement
    )
  }
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
 * Iterate over all feature flags and check for the corresponding environment variable
 * (of the form NEW_RELIC_FEATURE_FLAG_<feature flag name in upper case>).
 */
Config.prototype._featureFlagsFromEnv = function _featureFlagsFromEnv() {
  const flags = Object.keys(feature_flag.prerelease).concat(feature_flag.released)
  const config = this
  flags.forEach(function checkFlag(flag) {
    const envVal = process.env['NEW_RELIC_FEATURE_FLAG_' + flag.toUpperCase()]
    if (envVal) {
      config.feature_flag[flag] = isTruthular(envVal)
    }
  })
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
  if (!metadata) metadata = ENV.ENV_MAPPING
  if (!data) data = this

  Object.keys(metadata).forEach(function applyEnvDefault(value) {
    // if it's not in the config, it doesn't exist
    if (data[value] === undefined) {
      return
    }

    var node = metadata[value]
    if (typeof node === 'string') {
      var setting = process.env[node]
      if (setting) {
        if (ENV.LIST_VARS.has(node)) {
          data[value] = setting.split(',').map(function trimVal(k) {
            return k.trim()
          })
        } else if (ENV.OBJECT_LIST_VARS.has(node)) {
          data[value] = fromObjectList(setting)
        } else if (ENV.BOOLEAN_VARS.has(node)) {
          if (value === 'ssl' && !isTruthular(setting)) {
            logger.warn('SSL config key can no longer be disabled, not updating.')
            return
          }
          data[value] = isTruthular(setting)
        } else if (ENV.FLOAT_VARS.has(node)) {
          data[value] = parseFloat(setting, 10)
        } else if (ENV.INT_VARS.has(node)) {
          data[value] = parseInt(setting, 10)
        } else {
          data[value] = setting
        }
      }
    } else {
      // don't crash if the mapping has config keys the current config doesn't.
      if (!data[value]) data[value] = Object.create(null)
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
  var statusCodes = this.error_collector && this.error_collector.ignore_status_codes
  if (statusCodes) {
    this.error_collector.ignore_status_codes = _parseCodes(statusCodes)
  }

  var logAliases = {
    verbose: 'trace',
    debugging: 'debug',
    warning: 'warn',
    err: 'error'
  }
  var level = this.logging.level
  this.logging.level = logAliases[level] || level

  if (this.host === '') {
    var region = parseKey(this.license_key)
    if (region) {
      this.host = 'collector.' + region + '.nr-data.net'
    } else {
      this.host = 'collector.newrelic.com'
    }
  }

  // If new props are explicitly set (ie, not the default), use those
  this.attributes.exclude = this.attributes.exclude.length
    ? this.attributes.exclude
    : this.ignored_params
  this.attributes.enabled = this.attributes.enabled
    ? this.attributes.enabled
    : this.capture_params
  this.api.custom_attributes_enabled = !this.api.custom_attributes_enabled
    ? this.api.custom_attributes_enabled
    : this.api.custom_parameters_enabled
}

function _parseCodes(codes) {
  // range does not support negative values
  function parseRange(range, parsed) {
    var split = range.split('-')
    if (split.length !== 2) {
      logger.warn('Failed to parse range %s', range)
      return parsed
    }
    if (split[0] === '') { // catch negative code. ex. -7
      return parsed.push(parseInt(range, 10))
    }
    var lower = parseInt(split[0], 10)
    var upper = parseInt(split[1], 10)
    if (Number.isNaN(lower) || Number.isNaN(upper)) {
      logger.warn('Range must contain two numbers %s', range)
      return parsed
    }
    if (lower > upper) {
      logger.warn('Range must start with lower bound %s', range)
    } else if (lower < 0 || upper > 1000) {
      logger.warn('Range must be between 0 and 1000 %s', range)
    } else { // success
      for (var i = lower; i <= upper; i++) {
        parsed.push(i)
      }
    }
    return parsed
  }

  var parsedCodes = []
  for (var i = 0; i < codes.length; i++) {
    var code = codes[i]
    var parsedCode
    if (typeof code === 'string' && code.indexOf('-') !== -1) {
      parseRange(code, parsedCodes)
    } else {
      parsedCode = parseInt(code, 10)
      if (!Number.isNaN(parsedCode)) {
        parsedCodes.push(parsedCode)
      } else {
        logger.warn('Failed to parse status code %s', code)
      }
    }
  }
  return parsedCodes
}

/**
 * This goes through the settings that high security mode needs and coerces
 * them to be correct.
 */
Config.prototype._applyHighSecurity = function _applyHighSecurity() {
  var config = this
  checkNode('', this, HSM.HIGH_SECURITY_SETTINGS)

  function checkNode(base, target, settings) {
    Object.keys(settings).forEach(checkKey.bind(null, base, target, settings))
  }

  function checkKey(base, target, settings, key) {
    var hsValue = settings[key]

    if (hsValue && typeof hsValue === 'object' && !(hsValue instanceof Array)) {
      if (typeof target[key] !== 'object') {
        logger.warn(
          'High Security Mode: %s should be an object, found %s',
          key,
          target[key]
        )
        target[key] = Object.create(null)
      }

      return checkNode(base + key + '.', target[key], hsValue)
    }

    if (target[key] !== hsValue) {
      logger.warn('High Security Mode: %s was set to %s, coercing to %s',
                  key, target[key], hsValue)
      target[key] = hsValue
      config.emit(base + key, hsValue)
    }
  }
}

/**
 * Checks policies received from preconnect against those expected
 * by the agent, if LASP-enabled. Responds with an error to shut down
 * the agent if necessary.
 *
 * @param {object} policies
 * @param {function} callback
 *
 * @returns {object} known policies
 */
Config.prototype.applyLasp = function applyLasp(agent, policies, callback) {
  var config = this
  var error = null
  var keys = Object.keys(policies)

  if (!config.security_policies_token) {
    if (keys.length) {
      error = new Error(
        'The agent received one or more unexpected security policies and will shut down.'
      )
      logger.error(error)
    }
    return callback(error, null)
  }

  var missingLASP = []
  var missingRequired = []

  var res = keys.reduce(function applyPolicy(obj, name) {
    var policy = policies[name]
    var localMapping = LASP_MAP[name]

    if (!localMapping) {
      if (!policy.required) {
        // policy is not implemented in agent -- don't send to connect
        return obj
      }
      // policy is required but does not exist in agent -- fail
      missingRequired.push(name)
    } else {
      var splitConfigName = localMapping.path.split('.')
      var settingBlock = config[splitConfigName[0]]
      // pull out the configuration subsection that the option lives in
      for (var i = 1; i < splitConfigName.length - 1; ++i) {
        settingBlock = settingBlock[splitConfigName[i]]
      }
      var valueName = splitConfigName[splitConfigName.length - 1]
      var localVal = settingBlock[valueName]
      var policyValues = localMapping.allowedValues
      var policyValue = policyValues[policy.enabled ? 1 : 0]
      // get the most secure setting between local config and the policy
      var finalValue = settingBlock[valueName] = config._getMostSecure(
        name,
        localVal,
        policyValue
      )
      policy.enabled = policyValues.indexOf(finalValue) === 1
      obj[name] = policy

      if (finalValue !== localVal) {
        // finalValue is more secure than original local val,
        // so drop corresponding data
        localMapping.clearData(agent)
      }
    }

    return obj
  }, Object.create(null))

  Object.keys(LASP_MAP).forEach(function checkPolicy(name) {
    if (!policies[name]) {
      // agent is expecting a policy that was not sent from server -- fail
      missingLASP.push(name)
    }
  })

  if (missingLASP.length) {
    error = new Error(
      'The agent did not receive one or more security policies that it ' +
      'expected and will shut down: ' + missingLASP.join(', ') + '.'
    )
  } else if (missingRequired.length) {
    error = new Error(
      'The agent received one or more required security policies that it ' +
      'does not recognize and will shut down: ' + missingRequired.join(', ') +
      '. Please check if a newer agent version supports these policies ' +
      'or contact support.'
    )
    error.class = ERRORS.DISCONNECT
  }

  if (error) {
    logger.error(error)
  }

  callback(error, res)
}

Config.prototype.validateFlags = function validateFlags() {
  Object.keys(this.feature_flag).forEach(function forEachFlag(key) {
    if (feature_flag.released.indexOf(key) > -1) {
      logger.warn('Feature flag %s has been released', key)
    }
    if (feature_flag.unreleased.indexOf(key) > -1) {
      logger.warn('Feature flag %s has been deprecated', key)
    }
  })
}

/**
 * Get a JSONifiable object containing all settings we want to report to the
 * collector and store in the environment_values table.
 *
 * @return Object containing simple key-value pairs of settings
 */
Config.prototype.publicSettings = function publicSettings() {
  var settings = Object.create(null)

  for (var key in this) {
    if (this.hasOwnProperty(key)) {
      if (HSM.REDACT_BEFORE_SEND.has(key)) {
        settings[key] = '****'
      } else if (!HSM.REMOVE_BEFORE_SEND.has(key)) {
        settings[key] = this[key]
      }
    }
  }

  // Agent-side setting is 'enable', but collector-side setting is
  // 'auto_instrument'. Send both values up.
  settings.browser_monitoring.auto_instrument = settings.browser_monitoring.enable

  try {
    settings = stringify(settings)
    // Remove simple circular references
    return flatten(Object.create(null), '', JSON.parse(settings))
  } catch (err) {
    logger.error(err, 'Unable to stringify settings object')
  }
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
  logger = require('../logger')

  if (config) return new Config(config)

  if (isTruthular(process.env.NEW_RELIC_NO_CONFIG_FILE)) {
    config = new Config(Object.create(null))
    if (config.newrelic_home) delete config.newrelic_home
    return config
  }

  var filepath = _findConfigFile()
  if (!filepath) {
    _noConfigFile()
    return null
  }

  var userConf
  try {
    userConf = require(filepath).config
  } catch (error) {
    logger.error(error)

    throw new Error(
      "Unable to read configuration file " + filepath + ". A default\n" +
      "configuration file can be copied from " + DEFAULT_CONFIG_PATH + "\n" +
      "and renamed to 'newrelic.js' in the directory from which you'll be starting\n" +
      "your application."
    )
  }

  config = new Config(userConf)
  config.config_file_path = filepath
  logger.debug("Using configuration file %s.", filepath)

  config.validateFlags()

  return config
}

function _noConfigFile() {
  const mainpath = path.resolve(path.join(process.cwd(), DEFAULT_FILENAME))
  // If agent was loaded with -r flag, default to the path of the file being executed
  const mainModule = process.mainModule && process.mainModule.filename || process.argv[1]
  const altpath = path.resolve(
    path.dirname(mainModule),
    DEFAULT_FILENAME
  )

  var locations
  if (mainpath !== altpath) {
    locations = mainpath + " or\n" + altpath
  } else {
    locations = mainpath
  }

  /* eslint-disable no-console */
  console.error(
    "Unable to find New Relic module configuration. A default\n" +
    "configuration file can be copied from " + DEFAULT_CONFIG_PATH + "\n" +
    "and put at " + locations + ". If you are not using file based config\n" +
    "please set the environment variable NEW_RELIC_NO_CONFIG_FILE=true"
  )
  /* eslint-enable no-console */
}

/**
 * This function honors the singleton nature of this module while allowing
 * consumers to just request an instance without having to worry if one was
 * already created.
 */
function getOrCreateInstance() {
  if (_configInstance === null) {
    _configInstance = initialize()
  }
  return _configInstance
}

/**
 * Preserve the legacy initializer, but also allow consumers to manage their
 * own configuration if they choose.
 */
Config.initialize = initialize
Config.getOrCreateInstance = getOrCreateInstance

module.exports = Config
