/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const AttributeFilter = require('./attribute-filter')
const CollectorResponse = require('../collector/response')
const copy = require('../util/copy')
const { config: defaultConfig, definition, setNestedKey } = require('./default')
const EventEmitter = require('events').EventEmitter
const featureFlag = require('../feature_flags')
const flatten = require('../util/flatten')
const fs = require('../util/unwrapped-core').fs
const hashes = require('../util/hashes')
const os = require('os')
const parseKey = require('../collector/key-parser').parseKey
const path = require('path')
const stringify = require('json-stringify-safe')
const util = require('util')
const MergeServerConfig = require('./merge-server-config')
const harvestConfigValidator = require('./harvest-config-validator')
const mergeServerConfig = new MergeServerConfig()
const { boolean: isTruthular } = require('./formatters')
const configDefinition = definition()

/**
 * CONSTANTS -- we gotta lotta 'em
 */
const AZURE_APP_NAME = 'APP_POOL_ID'
const DEFAULT_MAX_PAYLOAD_SIZE_IN_BYTES = 1000000
const BASE_CONFIG_PATH = require.resolve('../../newrelic')
const HAS_ARBITRARY_KEYS = new Set(['ignore_messages', 'expected_messages', 'labels'])

const LASP_MAP = require('./lasp').LASP_MAP
const HSM = require('./hsm')
const REMOVE_BEFORE_SEND = new Set(['attributeFilter'])
const SSL_WARNING = 'SSL config key can no longer be disabled, not updating.'
const SERVERLESS_DT_KEYS = ['account_id', 'primary_application_id', 'trusted_account_key']

const exists = fs.existsSync
let logger = null // Lazy-loaded in `initialize`.
let _configInstance = null

const getConfigFileNames = () =>
  [process.env.NEW_RELIC_CONFIG_FILENAME, 'newrelic.js', 'newrelic.cjs'].filter(Boolean)

const getConfigFileLocations = () =>
  [
    process.env.NEW_RELIC_HOME,
    process.cwd(),
    process.env.HOME,
    path.join(__dirname, '../../../..'), // above node_modules
    // the REPL has no main module
    process.mainModule && process.mainModule.filename
      ? path.dirname(process.mainModule.filename)
      : undefined
  ].filter(Boolean)

function _findConfigFile() {
  const configFileCandidates = getConfigFileLocations().reduce((files, configPath) => {
    const configFiles = getConfigFileNames().map((filename) =>
      path.join(path.resolve(configPath), filename)
    )

    return files.concat(configFiles)
  }, [])

  return configFileCandidates.find(exists)
}

function Config(config) {
  EventEmitter.call(this)

  // 1. start by cloning the defaults
  Object.assign(this, defaultConfig())

  // 2. initialize undocumented, internal-only default values

  // feature flags are mostly private settings for gating unreleased features
  // flags are set in the feature_flags.js file
  this.feature_flag = copy.shallow(featureFlag.prerelease)

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

  // this value is arbitrary
  this.max_trace_segments = 900

  this.entity_guid = null

  // feature level of this account
  this.product_level = 0
  // product-level related
  this.collect_traces = true
  this.collect_errors = true
  this.collect_span_events = true

  this.browser_monitoring.loader = 'rum'
  this.browser_monitoring.loader_version = ''

  // Settings to play nice with DLPs (see NODE-1044).
  this.simple_compression = false // Disables subcomponent compression
  this.put_for_data_send = false // Changes http verb for harvest

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

  // TODO: this may belong in canonicalize.
  if (!this.event_harvest_config) {
    this.event_harvest_config = {
      report_period_ms: 60000,
      harvest_limits: {
        analytic_event_data: this.transaction_events.max_samples_stored,
        custom_event_data: this.custom_insights_events.max_samples_stored,
        error_event_data: this.error_collector.max_event_samples_stored,
        span_event_data: this.span_events.max_samples_stored,
        log_event_data: this.application_logging.forwarding.max_samples_stored
      }
    }
  }

  // 7. serverless_mode specific settings
  this._enforceServerless(config)

  // 8. apply high security overrides
  if (this.high_security) {
    if (this.security_policies_token) {
      throw new Error(
        'Security Policies and High Security Mode cannot both be present ' +
          'in the agent configuration. If Security Policies have been set ' +
          'for your account, please ensure the security_policies_token is ' +
          'set but high_security is disabled (default).'
      )
    }
    this._applyHighSecurity()
  }

  // 9. Set instance attribute filter using updated context
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
 * helper object for merging server side values
 */
Config.prototype.mergeServerConfig = mergeServerConfig

/**
 * Accept any configuration passed back from the server. Will log all
 * recognized, unsupported, and unknown parameters.
 *
 * @param {object} json The config blob sent by New Relic.
 * @param {boolean} recursion flag indicating coming from server side config
 */
Config.prototype.onConnect = function onConnect(json, recursion) {
  json = json || Object.create(null)
  if (this.high_security && recursion !== true && !json.high_security) {
    this.agent_enabled = false
    this.emit('agent_enabled', false)
    return
  }
  if (Object.keys(json).length === 0) {
    return
  }

  Object.keys(json).forEach(function updateProp(key) {
    this._fromServer(json, key)
  }, this)

  this._warnDeprecations()

  this.emit('change', this)
}

Config.prototype._getMostSecure = function getMostSecure(key, currentVal, newVal) {
  const filter = LASP_MAP[key] && LASP_MAP[key].filter
  if (!this.security_policies_token || !filter) {
    // If we aren't applying something vetted by security policies we
    // just return the new value.
    return newVal
  }
  // Return the most secure if we have a filter to apply
  return filter(currentVal, newVal)
}

/**
 * Helper that checks if value from server is false
 * then updates the corresponding configuration enabled flag.
 * We never allow server-side config to enable a feature but you can disable
 *
 * @param {*} serverValue value from server
 * @param {string} key within configuration to disable its enabled flag
 */
Config.prototype._disableOption = function _disableOption(serverValue, key) {
  if (serverValue === false) {
    this[key].enabled = false
  }
}

/**
 * Updates harvest_limits for event_harvest_config if they are valid values
 *
 * @param {object} serverConfig harvest config from server
 * @param {string} key value from server side config that stores the event harvest config
 */
Config.prototype._updateHarvestConfig = function _updateHarvestConfig(serverConfig, key) {
  const val = serverConfig[key]
  const isValidConfig = harvestConfigValidator.isValidHarvestConfig(val)
  if (!isValidConfig) {
    this.emit(key, null)
    return
  }

  logger.info('Valid event_harvest_config received. Updating harvest cycles.', val)
  const limits = Object.keys(val.harvest_limits).reduce((acc, k) => {
    const v = val.harvest_limits[k]
    if (harvestConfigValidator.isValidHarvestValue(v)) {
      acc[k] = v
    } else {
      logger.info(`Omitting limit for ${k} due to invalid value ${v}`)
    }
    return acc
  }, {})
  val.harvest_limits = limits
  this[key] = val
  this.emit(key, val)
}

/**
 * The guts of the logic about how to deal with server-side configuration.
 *
 * @param {object} params A configuration dictionary.
 * @param {string} key    The particular configuration parameter to set.
 */
Config.prototype._fromServer = function _fromServer(params, key) {
  /* eslint-disable-next-line sonarjs/max-switch-cases */
  switch (key) {
    // handled by the connection
    case 'messages':
      break

    // per the spec this is the key where all server side configuration values will come from.
    case 'agent_config':
      if (this.ignore_server_configuration) {
        this.logDisabled(params, key)
      } else {
        this.onConnect(params[key], true)
      }

      break

    // if it's undefined or null, so be it
    case 'agent_run_id':
      this.run_id = params.agent_run_id
      break

    // if it's undefined or null, so be it
    case 'request_headers_map':
      this.request_headers_map = params.request_headers_map
      break

    // handled by config.onConnect
    case 'high_security':
      break

    // always accept these settings
    case 'cross_process_id':
    case 'encoding_key':
      this._alwaysUpdateIfChanged(params, key)
      if (this.cross_process_id && this.encoding_key) {
        this.obfuscatedId = hashes.obfuscateNameUsingKey(this.cross_process_id, this.encoding_key)
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
        this._updateNestedIfChanged(params, this.error_collector, key, 'capture_events')
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
        logger.warn(SSL_WARNING)
      }
      break

    case 'apdex_t':
    case 'web_transactions_apdex':
      this._updateIfChanged(params, key)
      break
    case 'event_harvest_config':
      this._updateHarvestConfig(params, key)
      break

    case 'collect_analytics_events':
      this._disableOption(params.collect_analytics_events, 'transaction_events')
      break

    case 'collect_custom_events':
      this._disableOption(params.collect_custom_events, 'custom_insights_events')
      break

    case 'collect_span_events':
      this._disableOption(params.collect_span_events, 'span_events')
      break

    case 'allow_all_headers':
      this._updateIfChanged(params, key)
      this._canonicalize()
      break

    //
    // Browser Monitoring
    //
    case 'browser_monitoring.loader':
      this._updateNestedIfChangedRaw(params, this.browser_monitoring, key, 'loader')
      break

    // these are used by browser_monitoring
    // and the api.getRUMHeader() method
    case 'js_agent_file':
    case 'js_agent_loader_file':
    case 'beacon':
    case 'error_beacon':
    case 'browser_key':
    case 'js_agent_loader':
      this._updateNestedIfChangedRaw(params, this.browser_monitoring, key, key)
      break

    //
    // Cross Application Tracer
    //
    case 'cross_application_tracer.enabled':
      this._updateNestedIfChanged(params, this.cross_application_tracer, key, 'enabled')
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
      this._validateThenUpdateStatusCodes(
        params,
        this.error_collector,
        'error_collector.ignore_status_codes',
        'ignore_status_codes'
      )
      this._canonicalize()
      break
    case 'error_collector.expected_status_codes':
      this._validateThenUpdateStatusCodes(
        params,
        this.error_collector,
        'error_collector.expected_status_codes',
        'expected_status_codes'
      )
      this._canonicalize()
      break
    case 'error_collector.ignore_classes':
      this._validateThenUpdateErrorClasses(
        params,
        this.error_collector,
        'error_collector.ignore_classes',
        'ignore_classes'
      )
      break
    case 'error_collector.expected_classes':
      this._validateThenUpdateErrorClasses(
        params,
        this.error_collector,
        'error_collector.expected_classes',
        'expected_classes'
      )
      break
    case 'error_collector.ignore_messages':
      this._validateThenUpdateErrorMessages(
        params,
        this.error_collector,
        'error_collector.ignore_messages',
        'ignore_messages'
      )
      break
    case 'error_collector.expected_messages':
      this._validateThenUpdateErrorMessages(
        params,
        this.error_collector,
        'error_collector.expected_messages',
        'expected_messages'
      )
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
      this._updateNestedIfChanged(params, this.transaction_events, key, 'enabled')
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

    // Entity GUID
    case 'entity_guid':
      this.entity_guid = params[key]
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

    // DT span event harvest config limits
    case 'span_event_harvest_config':
      this.span_event_harvest_config = {
        ...params[key]
      }
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
    case 'transaction_events.max_samples_stored':
    case 'transaction_tracer.attributes.enabled':
    case 'transaction_tracer.attributes.exclude':
    case 'transaction_tracer.attributes.include':
    case 'serverless_mode.enabled':
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
  const value = json[key]
  if (value != null && this[key] !== value) {
    if (Array.isArray(value) && Array.isArray(this[key])) {
      value.forEach(function pushIfNew(element) {
        if (this[key].indexOf(element) === -1) {
          this[key].push(element)
        }
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
 * and log that the value has changed.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value we're looking to set.
 */
Config.prototype._updateIfChanged = function _updateIfChanged(json, key) {
  this._updateNestedIfChanged(json, this, key, key)
}

/**
 * Expected and Ignored status code configuration values should look like this
 *
 *     [500,'501','503-507']
 *
 * If the server side config is not in this format, it might put the agent
 * in a world of hurt.  So, before we pass everything on to
 * _updateNestedIfChanged, we'll do some validation.
 *
 * @param {object} remote    JSON sent from New Relic.
 * @param {object} local     A portion of this configuration object.
 * @param {string} remoteKey The name sent by New Relic.
 * @param {string} localKey  The local name.
 */
Config.prototype._validateThenUpdateStatusCodes = _validateThenUpdateStatusCodes
function _validateThenUpdateStatusCodes(remote, local, remoteKey, localKey) {
  const valueToTest = remote[remoteKey]
  if (!Array.isArray(valueToTest)) {
    logger.warn(
      'Saw SSC (ignore|expect)_status_codes that is not an array, will not merge: %s',
      valueToTest
    )
    return
  }

  let valid = true
  valueToTest.forEach(function validateArray(thingToTest) {
    if (!('string' === typeof thingToTest || 'number' === typeof thingToTest)) {
      logger.warn(
        'Saw SSC (ignore|expect)_status_code that is not a number or string,' +
          'will not merge: %s',
        thingToTest
      )
      valid = false
    }
  })
  if (!valid) {
    return
  }

  return this._updateNestedIfChanged(remote, local, remoteKey, localKey)
}

/**
 * Expected and Ignored classes configuration values should look like this
 *
 *     ['Error','Again']
 *
 * If the server side config is not in this format, it might put the agent
 * in a world of hurt.  So, before we pass everything on to
 * _updateNestedIfChanged, we'll do some validation.
 *
 * @param {object} remote    JSON sent from New Relic.
 * @param {object} local     A portion of this configuration object.
 * @param {string} remoteKey The name sent by New Relic.
 * @param {string} localKey  The local name.
 */
Config.prototype._validateThenUpdateErrorClasses = _validateThenUpdateErrorClasses

function _validateThenUpdateErrorClasses(remote, local, remoteKey, localKey) {
  const valueToTest = remote[remoteKey]
  if (!Array.isArray(valueToTest)) {
    logger.warn(
      'Saw SSC (ignore|expect)_classes that is not an array, will not merge: %s',
      valueToTest
    )
    return
  }

  let valid = true
  Object.keys(valueToTest).forEach(function validateArray(key) {
    const thingToTest = valueToTest[key]
    if ('string' !== typeof thingToTest) {
      logger.warn(
        'Saw SSC (ignore|expect)_class that is not a string, will not merge: %s',
        thingToTest
      )
      valid = false
    }
  })
  if (!valid) {
    return
  }

  return this._updateNestedIfChanged(remote, local, remoteKey, localKey)
}

/**
 * Expected and Ignore messages configuration values should look like this
 *
 *     {'ErrorType':['Error Message']}
 *
 * If the server side config is not in this format, it might put the agent
 * in a world of hurt.  So, before we pass everything on to
 * _updateNestedIfChanged, we'll do some validation.
 *
 * @param {object} remote    JSON sent from New Relic.
 * @param {object} local     A portion of this configuration object.
 * @param {string} remoteKey The name sent by New Relic.
 * @param {string} localKey  The local name.
 */
Config.prototype._validateThenUpdateErrorMessages = _validateThenUpdateErrorMessages

function _validateThenUpdateErrorMessages(remote, local, remoteKey, localKey) {
  const valueToTest = remote[remoteKey]
  if (Array.isArray(valueToTest)) {
    logger.warn('Saw SSC (ignore|expect)_message that is an Array, will not merge: %s', valueToTest)
    return
  }

  if (!valueToTest) {
    logger.warn('SSC ignore|expect_message is null or undefined, will not merge')
    return
  }

  if ('object' !== typeof valueToTest) {
    logger.warn(
      'Saw SSC (ignore|expect)_message that is primitive/scaler, will not merge: %s',
      valueToTest
    )
    return
  }

  let valid = true
  Object.keys(valueToTest).forEach(function validateArray(key) {
    const arrayToTest = valueToTest[key]
    if (!Array.isArray(arrayToTest)) {
      logger.warn('Saw SSC message array that is not an array, will not merge: %s', arrayToTest)
      valid = false
    }
  })
  if (!valid) {
    return
  }

  return this._updateNestedIfChanged(remote, local, remoteKey, localKey)
}
/**
 * Some parameter values are nested, need a simple way to change them as well.
 * Will merge local and remote if and only if both are arrays.
 *
 * @param {object} remote    JSON sent from New Relic.
 * @param {object} local     A portion of this configuration object.
 * @param {string} remoteKey The name sent by New Relic.
 * @param {string} localKey  The local name.
 */
Config.prototype._updateNestedIfChanged = _updateNestedIfChanged

function _updateNestedIfChanged(remote, local, remoteKey, localKey) {
  // if high-sec mode is enabled, we do not accept server changes to high-sec
  if (this.high_security && HSM.HIGH_SECURITY_KEYS.indexOf(remoteKey) !== -1) {
    return this.logDisabled(remote, remoteKey)
  }
  return this._updateNestedIfChangedRaw(remote, local, remoteKey, localKey)
}

Config.prototype._updateNestedIfChangedRaw = _updateNestedIfChangedRaw

function _updateNestedIfChangedRaw(remote, local, remoteKey, localKey) {
  return this.mergeServerConfig.updateNestedIfChanged(
    this,
    remote,
    local,
    remoteKey,
    localKey,
    logger
  )
}

/**
 * Some parameter values are just to be passed on.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value we're looking to set.
 */
Config.prototype._emitIfSet = function _emitIfSet(json, key) {
  const value = json[key]
  if (value != null) {
    this.emit(key, value)
  }
}

/**
 * The agent would normally do something with this parameter, but server-side
 * configuration is disabled via local settings or HSM.
 *
 * @param {object} json Config blob sent by collector.
 * @param {string} key  Value the agent won't set.
 */
Config.prototype.logDisabled = function logDisabled(json, key) {
  const value = json[key]
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
  const value = json[key]
  if (value !== null && value !== undefined) {
    logger.debug(
      'Server-side configuration of %s is currently not supported by the ' +
        'Node.js agent. (Server sent value of %s.)',
      key,
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
  const value = json[key]
  logger.debug('New Relic sent unknown configuration parameter %s with value %s.', key, value)
}

/**
 * Gets the user set host display name. If not provided, it returns the default value.
 *
 * This function is written is this strange way because of the use of caching variables.
 * I wanted to cache the DisplayHost, but if I attached the variable to the config object,
 * it sends the extra variable to New Relic, which is not desired.
 *
 * @returns {string} display host name
 */
Config.prototype.getDisplayHost = getDisplayHost

Config.prototype.clearDisplayHostCache = function clearDisplayHostCache() {
  this.getDisplayHost = getDisplayHost
}

function getDisplayHost() {
  let _displayHost
  this.getDisplayHost = function getCachedDisplayHost() {
    return _displayHost
  }
  if (this.process_host.display_name === '') {
    _displayHost = this.getHostnameSafe()
    return _displayHost
  }
  const stringBuffer = Buffer.from(this.process_host.display_name, 'utf8')
  const numBytes = stringBuffer.length

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
 * process_host.ipv_preference setting.
 *
 * This function is written is this strange way because of the use of caching variables.
 * I wanted to cache the Hostname, but if I attached the variable to the config object,
 * it sends the extra variable to New Relic, which is not desired.
 *
 * @returns {string} host name
 */
Config.prototype.getHostnameSafe = getHostnameSafe

Config.prototype.clearHostnameCache = function clearHostnameCache() {
  this.getHostnameSafe = getHostnameSafe
}

Config.prototype.getIPAddresses = function getIPAddresses() {
  const addresses = Object.create(null)
  const interfaces = os.networkInterfaces()

  for (const interfaceKey in interfaces) {
    if (interfaceKey.match(/^lo/)) {
      continue
    }

    const interfaceDescriptions = interfaces[interfaceKey]
    for (let i = 0; i < interfaceDescriptions.length; i++) {
      const description = interfaceDescriptions[i]
      const family = description.family.toLowerCase()
      addresses[family] = description.address
    }
  }
  return addresses
}

function getHostnameSafe() {
  let _hostname
  const config = this
  this.getHostnameSafe = function getCachedHostname() {
    return _hostname
  }
  try {
    if (config.heroku.use_dyno_names) {
      const dynoName = process.env.DYNO
      _hostname = dynoName || os.hostname()
    } else {
      _hostname = os.hostname()
    }
    return _hostname
  } catch (e) {
    const addresses = this.getIPAddresses()

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
 *
 * @returns {Array} list of applications
 */
Config.prototype.applications = function applications() {
  const apps = this.app_name

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
 * @param {boolean} arbitrary flag indicating if it is in the HAS_ARBITRARY_KEYS set
 */
Config.prototype._fromPassed = function _fromPassed(external, internal, arbitrary) {
  if (!external) {
    return
  }
  if (!internal) {
    internal = this
  }

  Object.keys(external).forEach(function overwrite(key) {
    // if it's not in the defaults, it doesn't exist
    if (!arbitrary && internal[key] === undefined) {
      return
    }

    if (key === 'ssl' && !isTruthular(external.ssl)) {
      logger.warn(SSL_WARNING)
      return
    }

    let node = null
    try {
      node = external[key]
    } catch (err) {
      logger.warn('Error thrown on access of user config for key: %s', key)
      return
    }

    if (typeof node === 'object' && !Array.isArray(node) && !(node instanceof RegExp)) {
      // is top level and can have arbitrary keys
      const allowArbitrary = internal === this || HAS_ARBITRARY_KEYS.has(key)
      this._fromPassed(node, internal[key], allowArbitrary)
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
  const name = this.app_name
  if (
    name === null ||
    name === undefined ||
    name === '' ||
    (Array.isArray(name) && name.length === 0)
  ) {
    const azureName = process.env[AZURE_APP_NAME]
    if (azureName) {
      this.app_name = azureName.split(',')
    }
  }
}

/**
 * Iterate over all feature flags and check for the corresponding environment variable
 * (of the form NEW_RELIC_FEATURE_FLAG_<feature flag name in upper case>).
 */
Config.prototype._featureFlagsFromEnv = function _featureFlagsFromEnv() {
  const flags = Object.keys(featureFlag.prerelease).concat(featureFlag.released)
  const config = this
  flags.forEach(function checkFlag(flag) {
    const envVal = process.env['NEW_RELIC_FEATURE_FLAG_' + flag.toUpperCase()]
    if (envVal) {
      config.feature_flag[flag] = isTruthular(envVal)
    }
  })
}

/**
 * Creates an env var mapper from the configuration path value
 *
 * @param {string} key of configuration value
 * @param {Array} paths list of leaf nodes leading to configuration value
 * @returns {string} formatted env var name
 */
function deriveEnvVar(key, paths) {
  let configPath = paths.join('_')
  configPath = configPath ? `${configPath}_` : configPath
  return `NEW_RELIC_${configPath.toUpperCase()}${key.toUpperCase()}`
}

/**
 * Assigns the value of an env var to its corresponding configuration path
 *
 * @param {object} params object passed to fn
 * @param {object} params.config agent config
 * @param {string} params.key key to assign value
 * @param {string} params.envVar name of env var
 * @param {Function} params.formatter function to coerce env var as they are all strings
 * @param {Array} params.paths list of leaf nodes leading to the configuration value
 */
function setFromEnv({ config, key, envVar, formatter, paths }) {
  const setting = process.env[envVar]
  if (setting) {
    const formattedSetting = formatter ? formatter(setting, logger) : setting
    setNestedKey(config, [...paths, key], formattedSetting)
  }
}

/**
 * Recursively visit the nodes of the config definition and look for environment variable names, overriding any configuration values that are found.
 *
 * @param {object} [config=this] The current level of the configuration object.
 * @param {object} [data=configDefinition] The current level of the config definition object.
 * @param {Array} [paths=[]] keeps track of the nested path to properly derive the env var
 * @param {number} [objectKeys=1] indicator of how many keys exist in current node to know when to remove current node after all keys are processed
 */
Config.prototype._fromEnvironment = function _fromEnvironment(
  config = this,
  data = configDefinition,
  paths = [],
  objectKeys = 1
) {
  let keysSeen = 0
  Object.entries(data).forEach(([key, value]) => {
    const type = typeof value
    keysSeen++
    if (type === 'string') {
      const envVar = deriveEnvVar(key, paths)
      setFromEnv({ config, key, envVar, paths })
    } else if (type === 'object') {
      if (value.hasOwnProperty('env')) {
        setFromEnv({
          config,
          key,
          envVar: value.env,
          paths,
          formatter: value.formatter
        })
      } else if (value.hasOwnProperty('default')) {
        const envVar = deriveEnvVar(key, paths)
        setFromEnv({ config, key, envVar, formatter: value.formatter, paths })
      } else {
        paths.push(key)
        const { length } = Object.keys(value)
        this._fromEnvironment(config, value, paths, length)
      }
    }
  })

  // we have traversed every key in current object leaf node, remove wrapping key
  // to properly derive env vars of future leaf nodes
  if (keysSeen === objectKeys) {
    paths.pop()
  }
}

/**
 * Disables `logging.enabled` if not set in configuration file or environment variable.
 *
 * @param {*} inputConfig configuration passed to the Config constructor
 * @returns {void}
 */
Config.prototype._serverlessLogging = function _serverlessLogging(inputConfig) {
  const inputEnabled = inputConfig?.logging?.enabled
  const envEnabled = process.env.NEW_RELIC_LOG_ENABLED

  if (inputEnabled === undefined && envEnabled === undefined) {
    this.logging.enabled = false

    logger.info(
      'Logging is disabled by default when serverless_mode is enabled. ' +
        'If desired, enable logging via config file or environment variable and ' +
        'set filepath to a valid path for current environment, stdout or stderr.'
    )
  }
}

/**
 * Returns true if native-metrics has been manually enabled via configuration
 * file or environment variable
 *
 * @param {*} inputConfig configuration pass to the Config constructor
 * @returns {void}
 */
Config.prototype._serverlessNativeMetrics = function _serverlessNativeMetrics(inputConfig) {
  const inputEnabled = inputConfig?.plugins?.native_metrics?.enabled
  const envEnabled = process.env.NEW_RELIC_NATIVE_METRICS_ENABLED

  if (
    (inputEnabled !== undefined || envEnabled !== undefined) &&
    this.plugins.native_metrics.enabled
  ) {
    logger.info(
      'Enabling the native-metrics module when in serverless mode may greatly ' +
        'increase cold-start times. Given the limited benefit of the VM metrics' +
        'and general lack of control in a serverless environment, we do not ' +
        'recommend this trade-off.'
    )
  } else {
    this.plugins.native_metrics.enabled = false

    logger.info(
      'The native-metrics module is disabled by default when serverless_mode ' +
        'is enabled.  If desired, enable the native-metrics module via config file ' +
        'or environment variable.'
    )
  }
}

/**
 * Application name is not currently leveraged by our Lambda product (March 2021).
 * Defaulting the name removes burden on customers to set while avoiding
 * breaking should it be used in the future.
 *
 * @returns {void}
 */
Config.prototype._serverlessAppName = function _serverlessAppName() {
  if (!this.app_name || this.app_name.length === 0) {
    const namingSource = process.env.AWS_LAMBDA_FUNCTION_NAME
      ? 'process.env.AWS_LAMBDA_FUNCTION_NAME'
      : 'DEFAULT'

    const name = process.env.AWS_LAMBDA_FUNCTION_NAME || 'Serverless Application'
    this.app_name = [name]

    logger.info("Auto-naming serverless application to ['%s'] from: %s", name, namingSource)
  }
}

/**
 * Disables CAT in serverless mode
 */
Config.prototype._serverlessCAT = function _serverlessCAT() {
  if (this.cross_application_tracer.enabled) {
    this.cross_application_tracer.enabled = false
    logger.info('Cross application tracing is explicitly disabled in serverless_mode.')
  }
}

Config.prototype._serverlessInfiniteTracing = function _serverlessInfiniteTracing() {
  if (this.infinite_tracing.trace_observer.host) {
    this.infinite_tracing.trace_observer.host = ''
    this.infinite_tracing.trace_observer.port = ''
    logger.info('Infinite tracing is explicitly disabled in serverless_mode.')
  }
}

/**
 * Disables DT if account_id is not set.
 * Otherwise it will set trusted_account_key and primary_application_id accordingly.
 *
 * @returns {void}
 */
Config.prototype._serverlessDT = function _serverlessDT() {
  if (!this.account_id) {
    if (this.distributed_tracing.enabled) {
      logger.warn(
        'Using distributed tracing in serverless mode requires account_id be ' +
          'defined, either in your newrelic.js file or via environment variables. ' +
          'Disabling distributed tracing.'
      )
      this.distributed_tracing.enabled = false
    }
  } else {
    // default trusted_account_key to account_id
    this.trusted_account_key = this.trusted_account_key || this.account_id

    // Not required in serverless mode but must default to Unknown to function.
    this.primary_application_id = this.primary_application_id || 'Unknown'
  }
}

/**
 * In serverless mode we allow defer auth to the downstream serverless entities.
 * This means we set account_id, primary_application_id, and trusted_account_key in configuration.
 * This function sets all those to null because this.serverless_mode.enabled is falsey.
 *
 * @returns {void}
 */
Config.prototype._preventServerlessDT = function _preventServerlessDT() {
  // Don't allow DT config settings to be set if serverless_mode is disabled
  SERVERLESS_DT_KEYS.forEach((key) => {
    if (this[key]) {
      logger.warn(
        key +
          ' was configured locally without enabling serverless_mode. ' +
          'This local value will be ignored and set by the New Relic servers.'
      )
      this[key] = null
    }
  })
}

/**
 * Enforces config rules specific to running in serverless_mode:
 *   - disables cross_application_tracer.enabled if set
 *   - defaults logging to disabled
 *   - verifies data specific to running DT is defined either in config file of env vars
 *
 * @param {*} inputConfig configuration passed to the Config constructor
 */
Config.prototype._enforceServerless = function _enforceServerless(inputConfig) {
  if (this.serverless_mode.enabled) {
    this._serverlessAppName()
    this._serverlessCAT()
    this._serverlessInfiniteTracing()
    this._serverlessLogging(inputConfig)
    this._serverlessNativeMetrics(inputConfig)
    this._serverlessDT(inputConfig)
  } else {
    this._preventServerlessDT()
  }
}

/**
 * Depending on how the status codes are set, they could be strings, which
 * makes strict equality testing / indexOf fail. To keep things cheap, parse
 * them once, after configuration has finished loading. Other one-off shims
 * based on special properties of configuration values should go here as well.
 */
Config.prototype._canonicalize = function _canonicalize() {
  const statusCodes = this?.error_collector?.ignore_status_codes
  if (statusCodes) {
    this.error_collector.ignore_status_codes = _parseCodes(statusCodes)
  }

  const expectedCodes = this?.error_collector?.expected_status_codes
  if (expectedCodes) {
    this.error_collector.expected_status_codes = _parseCodes(expectedCodes)
  }

  const grpcStatusCodes = this?.grpc?.ignore_status_codes
  if (grpcStatusCodes) {
    this.grpc.ignore_status_codes = _parseCodes(grpcStatusCodes)
  }

  const logAliases = {
    verbose: 'trace',
    debugging: 'debug',
    warning: 'warn',
    err: 'error'
  }
  const level = this.logging.level
  this.logging.level = logAliases[level] || level

  const region = parseKey(this.license_key)
  if (this.host === '') {
    if (region) {
      this.host = `collector.${region}.nr-data.net`
    } else {
      this.host = 'collector.newrelic.com'
    }
  }
  if (this.otlp_endpoint === '') {
    if (region) {
      this.otlp_endpoint = `otlp.${region}.nr-data.net`
    } else {
      this.otlp_endpoint = 'otlp.nr-data.net'
    }
  }

  if (this.license_key) {
    this.license_key = this.license_key.trim()
  }
}

/**
 * Splits a range of status codes. It will not
 * allow negative values, non-numbers, or numbers above 1000.
 *
 * @param {string} range range of status codes 400-421
 * @param {Array} parsed list of parsed codes
 * @returns {Array} adds to the cleansed list of status codes
 * by removing any ranges and adds as elements
 */
function _parseRange(range, parsed) {
  const split = range.split('-')
  if (split.length !== 2) {
    logger.warn('Failed to parse range %s', range)
    return parsed
  }
  if (split[0] === '') {
    // catch negative code. ex. -7
    return parsed.push(parseInt(range, 10))
  }
  const lower = parseInt(split[0], 10)
  const upper = parseInt(split[1], 10)
  if (Number.isNaN(lower) || Number.isNaN(upper)) {
    logger.warn('Range must contain two numbers %s', range)
    return parsed
  }
  if (lower > upper) {
    logger.warn('Range must start with lower bound %s', range)
  } else if (lower < 0 || upper > 1000) {
    logger.warn('Range must be between 0 and 1000 %s', range)
  } else {
    // success
    for (let i = lower; i <= upper; i++) {
      parsed.push(i)
    }
  }
  return parsed
}

/**
 * Parses a list of status codes.  It can also
 * parse a range of status codes
 *
 * @param {Array} codes list of status codes
 * @returns {Array} cleansed list of status codes
 */
function _parseCodes(codes) {
  const parsedCodes = []
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]
    if (typeof code === 'string' && code.indexOf('-') !== -1) {
      _parseRange(code, parsedCodes)
    } else {
      const parsedCode = parseInt(code, 10)
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
  const config = this
  checkNode('', this, HSM.HIGH_SECURITY_SETTINGS)
  // as a one off, we add a global exclude rule to the list to keep from
  // clobbering user defined rules

  this.attributes.exclude.push('request.parameters.*')

  function checkNode(base, target, settings) {
    Object.keys(settings).forEach(checkKey.bind(null, base, target, settings))
  }

  function checkKey(base, target, settings, key) {
    const hsValue = settings[key]

    if (hsValue && typeof hsValue === 'object' && !(hsValue instanceof Array)) {
      if (typeof target[key] !== 'object') {
        logger.warn('High Security Mode: %s should be an object, found %s', key, target[key])
        target[key] = Object.create(null)
      }

      return checkNode(base + key + '.', target[key], hsValue)
    }

    if (target[key] !== hsValue) {
      logger.warn('High Security Mode: %s was set to %s, coercing to %s', key, target[key], hsValue)
      target[key] = hsValue
      config.emit(base + key, hsValue)
    }
  }
}

/**
 * Sends a response to collector for LASP application
 *
 * @param {Array} keys keys from a LASP policy
 * @returns {CollectorResponse} creates CollectorResponse with either preserve or shutdown
 */
function _laspReponse(keys) {
  if (keys.length) {
    logger.error('The agent received one or more unexpected security policies and will shut down.')
    return CollectorResponse.fatal(null)
  }
  return CollectorResponse.success(null)
}

/**
 * Applies the server side LASP policies to a local configuration object
 *
 * @param agent
 * @param {object} policies server side LASP policy
 * @returns {object} { missingRequired, finalPolicies } list of missing required fields and finalized LASP policy
 */
Config.prototype._buildLaspPolicy = function _buildLaspPolicy(agent, policies) {
  const config = this
  const keys = Object.keys(policies)
  const missingRequired = []

  const finalPolicies = keys.reduce(function applyPolicy(obj, name) {
    const policy = policies[name]
    const localMapping = LASP_MAP[name]

    if (!localMapping) {
      if (!policy.required) {
        // policy is not implemented in agent -- don't send to connect
        return obj
      }
      // policy is required but does not exist in agent -- fail
      missingRequired.push(name)
    } else {
      const splitConfigName = localMapping.path.split('.')
      let settingBlock = config[splitConfigName[0]]
      // pull out the configuration subsection that the option lives in
      for (let i = 1; i < splitConfigName.length - 1; ++i) {
        settingBlock = settingBlock[splitConfigName[i]]
      }
      const valueName = splitConfigName[splitConfigName.length - 1]
      const localVal = settingBlock[valueName]

      // Indexes into "allowed values" based on "enabled" setting
      // to retrieve proper mapping.
      const policyValues = localMapping.allowedValues
      const policyValue = policyValues[policy.enabled ? 1 : 0]

      // get the most secure setting between local config and the policy
      const finalValue = (settingBlock[valueName] = config._getMostSecure(
        name,
        localVal,
        policyValue
      ))
      policy.enabled = policyValues.indexOf(finalValue) === 1
      obj[name] = policy

      if (!policy.enabled && localMapping.applyAdditionalSettings) {
        localMapping.applyAdditionalSettings(config)
      }

      if (finalValue !== localVal) {
        // finalValue is more secure than original local val,
        // so drop corresponding data
        localMapping.clearData(agent)
      }
    }

    return obj
  }, Object.create(null))

  return { missingRequired, finalPolicies }
}

/**
 * Checks policies received from preconnect against those expected
 * by the agent, if LASP-enabled. Responds with an error to shut down
 * the agent if necessary.
 *
 * @param agent
 * @param {object} policies lasp policy
 * @returns {CollectorResponse} The result of the processing, with the known
 *  policies as the response payload.
 */
Config.prototype.applyLasp = function applyLasp(agent, policies) {
  const keys = Object.keys(policies)

  if (!this.security_policies_token) {
    return _laspReponse(keys)
  }

  const { finalPolicies, missingRequired } = this._buildLaspPolicy(agent, policies)

  const missingLASP = []
  Object.keys(LASP_MAP).forEach(function checkPolicy(name) {
    if (!policies[name]) {
      // agent is expecting a policy that was not sent from server -- fail
      missingLASP.push(name)
    }
  })

  let fatalMessage = null
  if (missingLASP.length) {
    fatalMessage =
      'The agent did not receive one or more security policies that it ' +
      'expected and will shut down: ' +
      missingLASP.join(', ') +
      '.'
  } else if (missingRequired.length) {
    fatalMessage =
      'The agent received one or more required security policies that it ' +
      'does not recognize and will shut down: ' +
      missingRequired.join(', ') +
      '. Please check if a newer agent version supports these policies ' +
      'or contact support.'
  }

  if (fatalMessage) {
    logger.error(fatalMessage)
    return CollectorResponse.fatal(null)
  }

  return CollectorResponse.success(finalPolicies)
}

Config.prototype.validateFlags = function validateFlags() {
  Object.keys(this.feature_flag).forEach(function forEachFlag(key) {
    if (featureFlag.released.indexOf(key) > -1) {
      logger.warn('Feature flag %s has been released', key)
    }
    if (featureFlag.unreleased.indexOf(key) > -1) {
      logger.warn('Feature flag %s has been deprecated', key)
    }
  })
}

function redactValue(value) {
  const REDACT_VALUE = '****'

  let result = null
  if (Array.isArray(value)) {
    // Redact each value so we know if was configured and how many values
    result = value.map(() => REDACT_VALUE)
  } else {
    result = REDACT_VALUE
  }

  return result
}

/**
 * Get a JSONifiable object containing all settings we want to report to the
 * collector and store in the environment_values table.
 *
 * @returns {object} containing simple key-value pairs of settings
 */
Config.prototype.publicSettings = function publicSettings() {
  let settings = Object.create(null)

  for (const key in this) {
    if (this.hasOwnProperty(key) && !REMOVE_BEFORE_SEND.has(key)) {
      if (HSM.REDACT_BEFORE_SEND.has(key)) {
        const value = this[key]
        settings[key] = redactValue(value)
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

Config.prototype.getAggregatorConfig = function getAggregatorConfig(method) {
  const harvestConfig = this.event_harvest_config
  const isValidConfig = harvestConfigValidator.isValidHarvestConfig(harvestConfig)
  const limit = harvestConfig.harvest_limits[method]
  if (!isValidConfig || !harvestConfigValidator.isValidHarvestValue(limit)) {
    return null
  }

  return {
    limit,
    periodMs: harvestConfig.report_period_ms
  }
}

Config.prototype._warnDeprecations = function _warnDeprecations() {
  // DT overrides CAT so only warn when CAT is actually used.
  if (this.cross_application_tracer.enabled && !this.distributed_tracing.enabled) {
    const deprecationWarning = [
      '[Deprecation Warning]: Cross Application Tracing (CAT) has been deprecated and will be ',
      'removed in a future major release. CAT has been replaced by Distributed Tracing (DT). ',
      'Enable DT by setting distributed_tracing: { enabled: true }.'
    ].join('')

    logger.infoOnce('Deprecation:CAT', deprecationWarning)
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
 * When node process environment variables and a config file are used,
 * the environment variables will override their corresponding
 * configuration file settings.
 *
 * @param {object} config Optional configuration to be used in place of a config file.
 * @returns {object} instantiated configuration object
 */
function initialize(config) {
  /**
   * When the logger is required here, it bootstraps itself and then
   * injects itself into this module's closure via setLogger on the
   * instance of the logger it creates.  Logs are queued until config
   * has been loaded to apply logging settings to bootstrapping logs
   */
  logger = require('../logger')

  if (config) {
    return new Config(config)
  }

  if (isTruthular(process.env.NEW_RELIC_NO_CONFIG_FILE)) {
    logger.info('NEW_RELIC_NO_CONFIG_FILE set, deferring to environment variables.')

    return createNewConfigObject(config)
  }

  const filepath = _findConfigFile()
  if (!filepath) {
    logger.info(
      [
        'Unable to find configuration file.',
        'If a configuration file is desired (common for non-containerized environments),',
        `a base configuration file can be copied from ${BASE_CONFIG_PATH}`,
        'and renamed to "newrelic.js" in the directory from which you will start',
        'your application.',
        'Attempting to start agent using environment variables.'
      ].join(' ')
    )

    return createNewConfigObject(config)
  }

  let userConf
  try {
    userConf = require(filepath).config
  } catch (error) {
    if (error.code === 'ERR_REQUIRE_ESM') {
      // Attempted to import newrelic.js or similar from an ESM module, error out early.
      throw error
    }
    logger.error(error)

    logger.warn(
      [
        `Unable to read existing configuration file "${filepath}".`,
        'To allow reading of the file (if desired),',
        'please ensure the application has read access and the file is exporting valid JSON.',
        'Attempting to start agent using environment variables.'
      ].join(' ')
    )
  }

  if (!userConf) {
    return createNewConfigObject(config)
  }

  config = new Config(userConf)
  config.config_file_path = filepath
  logger.debug('Using configuration file %s.', filepath)

  config.validateFlags()

  return config
}

/**
 * This helper function creates an empty configuration object
 *
 * @param {object} config current configuration object to overwrite
 * @returns {object} config new config object
 */
function createNewConfigObject(config) {
  config = new Config(Object.create(null))
  if (config.newrelic_home) {
    delete config.newrelic_home
  }
  return config
}

/**
 * This function honors the singleton nature of this module while allowing
 * consumers to just request an instance without having to worry if one was
 * already created.
 *
 * @returns {object} initialized configuration object
 */
function getOrCreateInstance() {
  if (_configInstance === null) {
    try {
      _configInstance = initialize()
    } catch (err) {
      /* eslint-disable no-console */
      console.error('New Relic for Node.js is disabled due to an error:')
      console.error(err.stack)
      /* eslint-enable no-console */

      // Config construction has potential to throw due to invalid settings.
      // This allows the agent to return a stub api without crashing the process.
      _configInstance = Object.assign(defaultConfig(), {
        agent_enabled: false,
        logging: {
          enabled: true,
          filepath: 'stdout'
        }
      })

      _configInstance.setLogger = Config.prototype.setLogger
    }
  }
  return _configInstance
}

function getInstance() {
  return _configInstance
}

function createInstance(config) {
  _configInstance = initialize(config)
  return _configInstance
}

/**
 * Preserve the legacy initializer, but also allow consumers to manage their
 * own configuration if they choose.
 */
Config.initialize = initialize
Config.getOrCreateInstance = getOrCreateInstance
Config.getInstance = getInstance
Config.createInstance = createInstance

module.exports = Config
