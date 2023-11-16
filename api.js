/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('util')
const logger = require('./lib/logger').child({ component: 'api' })
const recordWeb = require('./lib/metrics/recorders/http')
const recordBackground = require('./lib/metrics/recorders/other')
const customRecorder = require('./lib/metrics/recorders/custom')
const hashes = require('./lib/util/hashes')
const properties = require('./lib/util/properties')
const stringify = require('json-stringify-safe')
const shimmer = require('./lib/shimmer')
const isValidType = require('./lib/util/attribute-types')
const TransactionShim = require('./lib/shim/transaction-shim')
const TransactionHandle = require('./lib/transaction/handle')
const AwsLambda = require('./lib/serverless/aws-lambda')
const applicationLogging = require('./lib/util/application-logging')
const {
  assignCLMSymbol,
  addCLMAttributes: maybeAddCLMAttributes
} = require('./lib/util/code-level-metrics')
const { LlmFeedbackMessage } = require('./lib/llm-events/openai')

const ATTR_DEST = require('./lib/config/attribute-filter').DESTINATIONS
const MODULE_TYPE = require('./lib/shim/constants').MODULE_TYPE
const NAMES = require('./lib/metrics/names')
const obfuscate = require('./lib/util/sql/obfuscate')
const { DESTINATIONS } = require('./lib/config/attribute-filter')
const parse = require('module-details-from-path')
const { isSimpleObject } = require('./lib/util/objects')

/*
 *
 * CONSTANTS
 *
 */
const RUM_STUB = 'window.NREUM||(NREUM={});NREUM.info = %s; %s'
const RUM_STUB_SHELL = `<script type='text/javascript'>${RUM_STUB}</script>`
const RUM_STUB_SHELL_WITH_NONCE_PARAM = `<script type='text/javascript' %s>${RUM_STUB}</script>`

// these messages are used in the _gracefail() method below in getBrowserTimingHeader
const RUM_ISSUES = [
  'NREUM: no browser monitoring headers generated; disabled',
  'NREUM: transaction ignored while generating browser monitoring headers',
  'NREUM: config.browser_monitoring missing, something is probably wrong',
  'NREUM: browser_monitoring headers need a transaction name',
  'NREUM: browser_monitoring requires valid application_id',
  'NREUM: browser_monitoring requires valid browser_key',
  'NREUM: browser_monitoring requires js_agent_loader script',
  'NREUM: browser_monitoring disabled by browser_monitoring.loader config'
]

// Can't overwrite internal parameters or all heck will break loose.
const CUSTOM_DENYLIST = new Set(['nr_flatten_leading'])

const CUSTOM_EVENT_TYPE_REGEX = /^[a-zA-Z0-9:_ ]+$/

/**
 * The exported New Relic API. This contains all of the functions meant to be
 * used by New Relic customers.
 *
 * You do not need to directly instantiate this class, as an instance of this is
 * the return from `require('newrelic')`.
 *
 * @param {object} agent Instantiation of lib/agent.js
 * @class
 */
function API(agent) {
  this.agent = agent
  this.shim = new TransactionShim(agent, 'NewRelicAPI')
  this.awsLambda = new AwsLambda(agent)
}

/**
 * Give the current transaction a custom name. Overrides any New Relic naming
 * rules set in configuration or from New Relic's servers.
 *
 * IMPORTANT: this function must be called when a transaction is active. New
 * Relic transactions are tied to web requests, so this method may be called
 * from within HTTP or HTTPS listener functions, Express routes, or other
 * contexts where a web request or response object are in scope.
 *
 * @param {string} name The name you want to give the web request in the New
 *                      Relic UI. Will be prefixed with 'Custom/' when sent.
 * @returns {void}
 */
API.prototype.setTransactionName = function setTransactionName(name) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/setTransactionName'
  )
  metric.incrementCallCount()

  const transaction = this.agent.tracer.getTransaction()
  if (!transaction) {
    return logger.warn("No transaction found when setting name to '%s'.", name)
  }

  if (!name) {
    if (transaction && transaction.url) {
      logger.error('Must include name in setTransactionName call for URL %s.', transaction.url)
    } else {
      logger.error('Must include name in setTransactionName call.')
    }

    return
  }

  logger.trace('Setting transaction %s name to %s', transaction.id, name)
  transaction.forceName = NAMES.CUSTOM + '/' + name
}

/**
 * This method returns an object with the following methods:
 * - end: end the transaction that was active when `API#getTransaction`
 *   was called.
 *
 * - ignore: set the transaction that was active when
 *   `API#getTransaction` was called to be ignored.
 *
 * @returns {TransactionHandle} The transaction object with the `end` and
 *  `ignore` methods on it.
 */
API.prototype.getTransaction = function getTransaction() {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/getTransaction')
  metric.incrementCallCount()

  const transaction = this.agent.tracer.getTransaction()
  if (!transaction) {
    logger.debug('No transaction found when calling API#getTransaction')
    return new TransactionHandle.Stub()
  }

  transaction.handledExternally = true

  return new TransactionHandle(transaction, this.agent.metrics)
}

/**
 * This method returns an object with the following keys/data:
 * - `trace.id`: The current trace ID
 * - `span.id`: The current span ID
 * - `entity.name`: The application name specified in the connect request as
 *   app_name. If multiple application names are specified this will only be
 *   the first name
 * - `entity.type`: The string "SERVICE"
 * - `entity.guid`: The entity ID returned in the connect reply as entity_guid
 * - `hostname`: The hostname as specified in the connect request as
 *   utilization.full_hostname. If utilization.full_hostname is null or empty,
 *   this will be the hostname specified in the connect request as host.
 *
 * @param {boolean} omitSupportability Whether or not to log the supportability metric, true means skip
 * @returns {object} The LinkingMetadata object with the data above
 */
API.prototype.getLinkingMetadata = function getLinkingMetadata(omitSupportability) {
  if (omitSupportability !== true) {
    const metric = this.agent.metrics.getOrCreateMetric(
      NAMES.SUPPORTABILITY.API + '/getLinkingMetadata'
    )
    metric.incrementCallCount()
  }

  return this.agent.getLinkingMetadata()
}

/**
 * Specify the `Dispatcher` and `Dispatcher Version` environment values.
 * A dispatcher is typically the service responsible for brokering
 * the request with the process responsible for responding to the
 * request.  For example Node's `http` module would be the dispatcher
 * for incoming HTTP requests.
 *
 * @param {string} name The string you would like to report to New Relic
 *                      as the dispatcher.
 * @param {string} [version] The dispatcher version you would like to
 *                           report to New Relic
 */
API.prototype.setDispatcher = function setDispatcher(name, version) {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/setDispatcher')
  metric.incrementCallCount()

  if (!name || typeof name !== 'string') {
    logger.error('setDispatcher must be called with a name, and name must be a string.')
    return
  }

  // No objects allowed.
  if (version && typeof version !== 'object') {
    version = String(version)
  } else {
    logger.info('setDispatcher was called with an object as the version parameter')
    version = null
  }

  this.agent.environment.setDispatcher(name, version, true)
}

/**
 * Give the current transaction a name based on your own idea of what
 * constitutes a controller in your Node application. Also allows you to
 * optionally specify the action being invoked on the controller. If the action
 * is omitted, then the API will default to using the HTTP method used in the
 * request (e.g. GET, POST, DELETE). Overrides any New Relic naming rules set
 * in configuration or from New Relic's servers.
 *
 * IMPORTANT: this function must be called when a transaction is active. New
 * Relic transactions are tied to web requests, so this method may be called
 * from within HTTP or HTTPS listener functions, Express routes, or other
 * contexts where a web request or response object are in scope.
 *
 * @param {string} name   The name you want to give the controller in the New
 *                        Relic UI. Will be prefixed with 'Controller/' when
 *                        sent.
 * @param {string} action The action being invoked on the controller. Defaults
 *                        to the HTTP method used for the request.
 * @returns {void}
 */
API.prototype.setControllerName = function setControllerName(name, action) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/setControllerName'
  )
  metric.incrementCallCount()

  const transaction = this.agent.tracer.getTransaction()
  if (!transaction) {
    return logger.warn('No transaction found when setting controller to %s.', name)
  }

  if (!name) {
    if (transaction && transaction.url) {
      logger.error('Must include name in setControllerName call for URL %s.', transaction.url)
    } else {
      logger.error('Must include name in setControllerName call.')
    }

    return
  }

  action = action || transaction.verb || 'GET'
  transaction.forceName = NAMES.CONTROLLER + '/' + name + '/' + action
}

/**
 * Add a custom attribute to the current transaction. Some attributes are
 * reserved (see CUSTOM_DENYLIST for the current, very short list), and
 * as with most API methods, this must be called in the context of an
 * active transaction. Most recently set value wins.
 *
 * @param {string} key  The key you want displayed in the RPM UI.
 * @param {string} value The value you want displayed. Must be serializable.
 * @returns {false|undefined} Retruns false when disabled/errored, otherwise undefined
 */
API.prototype.addCustomAttribute = function addCustomAttribute(key, value) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/addCustomAttribute'
  )
  metric.incrementCallCount()

  // If high security mode is on, custom attributes are disabled.
  if (this.agent.config.high_security) {
    logger.warnOnce('Custom attributes', 'Custom attributes are disabled by high security mode.')
    return false
  } else if (!this.agent.config.api.custom_attributes_enabled) {
    logger.debug('Config.api.custom_attributes_enabled set to false, not collecting value')
    return false
  }

  const transaction = this.agent.tracer.getTransaction()
  if (!transaction) {
    logger.warn('No transaction found for custom attributes.')
    return false
  }

  const trace = transaction.trace
  if (!trace.custom) {
    logger.warn('Could not add attribute %s to nonexistent custom attributes.', key)
    return false
  }

  if (CUSTOM_DENYLIST.has(key)) {
    logger.warn('Not overwriting value of NR-only attribute %s.', key)
    return false
  }

  trace.addCustomAttribute(key, value)

  const spanContext = this.agent.tracer.getSpanContext()
  if (!spanContext) {
    logger.debug('No span found for custom attributes.')
    // success/failure is ambiguous here. since at least 1 attempt tried, not returning false
    return
  }

  spanContext.addCustomAttribute(key, value, spanContext.ATTRIBUTE_PRIORITY.LOW)
}

/**
 * Adds all custom attributes in an object to the current transaction.
 *
 * See documentation for newrelic.addCustomAttribute for more information on
 * setting custom attributes.
 *
 * An example of setting a custom attribute object:
 *
 *    newrelic.addCustomAttributes({test: 'value', test2: 'value2'});
 *
 * @param {object} [atts] Attribute object
 * @param {string} [atts.KEY] The name you want displayed in the RPM UI.
 * @param {string} [atts.KEY.VALUE] The value you want displayed. Must be serializable.
 */
API.prototype.addCustomAttributes = function addCustomAttributes(atts) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/addCustomAttributes'
  )
  metric.incrementCallCount()

  for (const key in atts) {
    if (!properties.hasOwn(atts, key)) {
      continue
    }

    this.addCustomAttribute(key, atts[key])
  }
}

/**
 * Add custom span attributes in an object to the current segment/span.
 *
 * See documentation for newrelic.addCustomSpanAttribute for more information.
 *
 * An example of setting a custom span attribute:
 *
 *    newrelic.addCustomSpanAttribute({test: 'value', test2: 'value2'})
 *
 * @param {object} [atts] Attribute object
 * @param {string} [atts.KEY] The name you want displayed in the RPM UI.API.
 * @param {string} [atts.KEY.VALUE] The value you want displayed.  Must be serializable.
 */
API.prototype.addCustomSpanAttributes = function addCustomSpanAttributes(atts) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/addCustomSpanAttributes'
  )
  metric.incrementCallCount()

  for (const key in atts) {
    if (properties.hasOwn(atts, key)) {
      this.addCustomSpanAttribute(key, atts[key])
    }
  }
}

/**
 * Add a custom span attribute to the current transaction. Some attributes
 * are reserved (see CUSTOM_DENYLIST for the current, very short list), and
 * as with most API methods, this must be called in the context of an
 * active segment/span. Most recently set value wins.
 *
 * @param {string} key  The key you want displayed in the RPM UI.
 * @param {string} value The value you want displayed. Must be serializable.
 * @returns {false|undefined} Retruns false when disabled/errored, otherwise undefined
 */
API.prototype.addCustomSpanAttribute = function addCustomSpanAttribute(key, value) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/addCustomSpanAttribute'
  )
  metric.incrementCallCount()

  // If high security mode is on, custom attributes are disabled.
  if (this.agent.config.high_security) {
    logger.warnOnce(
      'Custom span attributes',
      'Custom span attributes are disabled by high security mode.'
    )
    return false
  } else if (!this.agent.config.api.custom_attributes_enabled) {
    logger.debug('Config.api.custom_attributes_enabled set to false, not collecting value')
    return false
  }

  const spanContext = this.agent.tracer.getSpanContext()

  if (!spanContext) {
    logger.debug('Could not add attribute %s. No available span.', key)
    return false
  }

  if (CUSTOM_DENYLIST.has(key)) {
    logger.warn('Not overwriting value of NR-only attribute %s.', key)
    return false
  }

  spanContext.addCustomAttribute(key, value)
}

/**
 * Send errors to New Relic that you've already handled yourself. Should be an
 * `Error` or one of its subtypes, but the API will handle strings and objects
 * that have an attached `.message` or `.stack` property.
 *
 * An example of using this function is
 *
 *    try {
 *      performSomeTask();
 *    } catch (err) {
 *      newrelic.noticeError(
 *        err,
 *        {extraInformation: "error already handled in the application"},
 *        true
 *      );
 *    }
 *
 * NOTE: Errors that are recorded using this method do _not_ obey the
 * `ignore_status_codes` configuration.
 *
 * @param {Error} error
 *  The error to be traced.
 * @param {object} [customAttributes]
 *  Optional. Any custom attributes to be displayed in the New Relic UI.
 * @param {boolean} expected
 *  Optional. False by default. True if the error is expected, meaning it should be collected
 *  for error events and traces, but should not impact error rate.
 * @returns {false|undefined} Returns false when disabled/errored, otherwise undefined
 */
API.prototype.noticeError = function noticeError(error, customAttributes, expected = false) {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/noticeError')
  metric.incrementCallCount()

  // let users skip the custom attributes if they want
  if (customAttributes && typeof customAttributes === 'boolean') {
    expected = customAttributes
    customAttributes = null
  }

  if (!this.agent.config.api.notice_error_enabled) {
    logger.debug('Config.api.notice_error_enabled set to false, not collecting error')
    return false
  }

  // If high security mode is on or custom attributes are disabled,
  // noticeError does not collect custom attributes.
  if (this.agent.config.high_security) {
    logger.debug('Passing custom attributes to notice error API is disabled in high security mode.')
  } else if (!this.agent.config.api.custom_attributes_enabled) {
    logger.debug(
      'Config.api.custom_attributes_enabled set to false, ' + 'ignoring custom error attributes.'
    )
  }

  if (typeof error === 'string') {
    error = new Error(error)
  }

  // Filter all object type valued attributes out
  let filteredAttributes = customAttributes
  if (customAttributes) {
    filteredAttributes = _filterAttributes(customAttributes, 'noticeError')
  }

  const transaction = this.agent.tracer.getTransaction()
  this.agent.errors.addUserError(transaction, error, filteredAttributes, expected)
}

/**
 * Sends an application log message to New Relic. The agent already
 * automatically does this for some instrumented logging libraries,
 * but in case you are using another logging method that is not
 * already instrumented by the agent, you can use this function
 * instead.
 *
 * If application log forwarding is disabled in the agent
 * configuration, this function does nothing.
 *
 * An example of using this function is
 *
 *    newrelic.recordLogEvent({
 *       message: 'cannot find file',
 *       level: 'ERROR',
 *       error: new SystemError('missing.txt')
 *    })
 *
 * @param {object} logEvent The log event object to send. Any
 *   attributes besides `message`, `level`, `timestamp`, and `error` are
 *   recorded unchanged. The `logEvent` object itself will be mutated by
 *   this function.
 * @param {string} logEvent.message The log message.
 * @param {string} logEvent.level The log level severity. If this key is
 *   missing, it will default to UNKNOWN
 * @param {number} logEvent.timestamp   ECMAScript epoch number denoting the
 *   time that this log message was produced. If this key is missing,
 *   it will default to the output of `Date.now()`.
 * @param {Error} logEvent.error Error associated to this log event. Ignored if missing.
 */
API.prototype.recordLogEvent = function recordLogEvent(logEvent = {}) {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/recordLogEvent')
  metric.incrementCallCount()

  if (!applicationLogging.isLogForwardingEnabled(this.agent.config, this.agent)) {
    logger.warnOnce(
      'Record logs',
      'Application log forwarding disabled, method API#recordLogEvent will not record messages'
    )
    return
  }

  // If they don't pass a logEvent object, or it doesn't have the
  // required `message` key, bail out.
  if (typeof logEvent !== 'object' || logEvent.message === undefined) {
    logger.warn(
      'recordLogEvent requires an object with a `message` attribute for its single argument, got %s (%s)',
      stringify(logEvent),
      typeof logEvent
    )
    return
  }
  logEvent.message = applicationLogging.truncate(logEvent.message)

  if (!logEvent.level) {
    logger.debug('no log level set, setting it to UNKNOWN')
    logEvent.level = 'UNKNOWN'
  }

  if (typeof logEvent.timestamp !== 'number') {
    logger.debug('no timestamp set, setting it to `Date.now()`')
    logEvent.timestamp = Date.now()
  }

  if (logEvent.error) {
    logEvent['error.message'] = applicationLogging.truncate(logEvent.error.message)
    logEvent['error.stack'] = applicationLogging.truncate(logEvent.error.stack)
    logEvent['error.class'] =
      logEvent.error.name === 'Error' ? logEvent.error.constructor.name : logEvent.error.name
    delete logEvent.error
  }

  if (applicationLogging.isMetricsEnabled(this.agent.config)) {
    applicationLogging.incrementLoggingLinesMetrics(logEvent.level, this.agent.metrics)
  }

  const metadata = this.agent.getLinkingMetadata()
  this.agent.logs.add(Object.assign({}, logEvent, metadata))
}

/**
 * If the URL for a transaction matches the provided pattern, name the
 * transaction with the provided name. If there are capture groups in the
 * pattern (which is a standard JavaScript regular expression, and can be
 * passed as either a RegExp or a string), then the substring matches ($1, $2,
 * etc.) are replaced in the name string. BE CAREFUL WHEN USING SUBSTITUTION.
 * If the replacement substrings are highly variable (i.e. are identifiers,
 * GUIDs, or timestamps), the rule will generate too many metrics and
 * potentially get your application blocked by New Relic.
 *
 * An example of a good rule with replacements:
 *
 *   newrelic.addNamingRule('^/storefront/(v[1-5])/(item|category|tag)',
 *                          'CommerceAPI/$1/$2')
 *
 * An example of a bad rule with replacements:
 *
 *   newrelic.addNamingRule('^/item/([0-9a-f]+)', 'Item/$1')
 *
 * Keep in mind that the original URL and any query parameters will be sent
 * along with the request, so slow transactions will still be identifiable.
 *
 * Naming rules can not be removed once added. They can also be added via the
 * agent's configuration. See configuration documentation for details.
 *
 * @param {RegExp} pattern The pattern to rename (with capture groups).
 * @param {string} name    The name to use for the transaction.
 * @returns {void}
 */
API.prototype.addNamingRule = function addNamingRule(pattern, name) {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/addNamingRule')
  metric.incrementCallCount()

  if (!name) {
    return logger.error('Simple naming rules require a replacement name.')
  }

  this.agent.userNormalizer.addSimple(pattern, '/' + name)
}

/**
 * If the URL for a transaction matches the provided pattern, ignore the
 * transaction attached to that URL. Useful for filtering socket.io connections
 * and other long-polling requests out of your agents to keep them from
 * distorting an app's apdex or mean response time. Pattern may be a (standard
 * JavaScript) RegExp or a string.
 *
 * Example:
 *
 *   newrelic.addIgnoringRule('^/socket\\.io/')
 *
 * @param {RegExp} pattern The pattern to ignore.
 * @returns {void}
 */
API.prototype.addIgnoringRule = function addIgnoringRule(pattern) {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/addIgnoringRule')
  metric.incrementCallCount()

  if (!pattern) {
    return logger.error('Must include a URL pattern to ignore.')
  }

  this.agent.userNormalizer.addSimple(pattern, null)
}

/**
 * Gracefully fail.
 *
 * Output an HTML comment and log a warning the comment is meant to be
 * innocuous to the end user.
 *
 * @see RUM_ISSUES
 * @param {number} errorCode Error code from `RUM_ISSUES`.
 * @param {boolean} [quiet=false] Be quiet about this failure.
 * @returns {string} HTML comment for debugging purposes with specific error code
 */
function _gracefail(errorCode, quiet) {
  if (quiet) {
    logger.debug(RUM_ISSUES[errorCode])
  } else {
    logger.warn(RUM_ISSUES[errorCode])
  }
  return '<!-- NREUM: (' + errorCode + ') -->'
}

/**
 * Function for generating a fully formed RUM header based on configuration options
 *
 * @param {object} options Configuration options for RUM
 * @param {string} [options.nonce] Nonce to inject into `<script>` header.
 * @param {boolean} [options.hasToRemoveScriptWrapper] Used to import agent script without `<script>` tag wrapper.
 * @param {string} metadata Stringified representation of rumHash metadata
 * @param {string} loader Agent Loader script
 * @returns {string} fully formed RUM header
 */
function _generateRUMHeader(options = {}, metadata, loader) {
  const formatArgs = []

  if (options.hasToRemoveScriptWrapper) {
    formatArgs.push(RUM_STUB)
  } else if (options.nonce) {
    formatArgs.push(RUM_STUB_SHELL_WITH_NONCE_PARAM, `nonce="${options.nonce}"`)
  } else {
    formatArgs.push(RUM_STUB_SHELL)
  }

  formatArgs.push(metadata, loader)

  return util.format(...formatArgs)
}

/**
 * Helper method for determining if we have the minimum required
 * information to generate our Browser Agent script tag
 *
 * @param {object} config agent configuration settings
 * @param {Transaction} transaction the active transaction or null
 * @param {boolean} allowTransactionlessInjection whether or not to allow the Browser Agent to be injected when there is no active transaction
 * @returns {{ isValidConfig: boolean, failureIdx: number, quietMode: boolean }} object containing validation results
 */
function validateBrowserMonitoring(config, transaction, allowTransactionlessInjection) {
  /*
   * config.browser_monitoring should always exist, but we don't want the agent
   * to bail here if something goes wrong
   */
  if (!config.browser_monitoring) {
    return { isValidConfig: false, failureIdx: 2 }
  }

  /*
   * Can control header generation with configuration this setting is only
   * available in the newrelic.js config file, it is not ever set by the
   * server.
   */
  if (!config.browser_monitoring.enable) {
    // It has been disabled by the user; no need to warn them about their own
    // settings so fail quietly and gracefully.
    return { isValidConfig: false, failureIdx: 0, quietMode: true }
  }

  /*
   * This is only going to work if the agent has successfully handshaked with
   * the collector. If the networks is bad, or there is no license key set in
   * newrelic.js, there will be no application_id set.  We bail instead of
   * outputting null/undefined configuration values.
   */
  if (!config.application_id) {
    return { isValidConfig: false, failureIdx: 4 }
  }

  /*
   * If there is no browser_key, the server has likely decided to disable
   * browser monitoring.
   */
  if (!config.browser_monitoring.browser_key) {
    return { isValidConfig: false, failureIdx: 5 }
  }

  /*
   * If there is no agent_loader script, there is no point
   * in setting the rum data
   */
  if (!config.browser_monitoring.js_agent_loader) {
    return { isValidConfig: false, failureIdx: 6 }
  }

  /*
   * If rum is enabled, but then later disabled on the server,
   * this is the only parameter that gets updated.
   *
   * This condition should only be met if rum is disabled during
   * the lifetime of an application, and it should be picked up
   * on the next ForceRestart by the collector.
   */
  if (config.browser_monitoring.loader === 'none') {
    return { isValidConfig: false, failureIdx: 7 }
  }

  if (!allowTransactionlessInjection && !transaction) {
    return { isValidConfig: false, failureIdx: 1 }
  }

  return { isValidConfig: true }
}

/**
 * Get the script header necessary for Browser Monitoring
 * This script must be manually injected into your templates, as high as possible
 * in the header, but _after_ any X-UA-COMPATIBLE HTTP-EQUIV meta tags.
 * Otherwise you may hurt IE!
 *
 * By default this method will return a script wrapped by `<script>` tags, but with
 * option `hasToRemoveScriptWrapper` it can send back only the script content
 * without the `<script>` wrapper. Useful for React component based frontend.
 *
 * This method must be called every time you want to generate the headers.
 *
 * Do *not* reuse the headers between users, or even between requests.
 *
 * @param {object} options configuration options
 * @param {string} [options.nonce] - Nonce to inject into `<script>` header.
 * @param {boolean} [options.hasToRemoveScriptWrapper] - Used to import agent script without `<script>` tag wrapper.
 * @param {options} [options.allowTransactionlessInjection] Whether or not to allow the Browser Agent to be injected when there is no active transaction
 * @returns {string} The script content to be injected in `<head>` or put inside `<script>` tag (depending on options)
 */
API.prototype.getBrowserTimingHeader = function getBrowserTimingHeader(options = {}) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/getBrowserTimingHeader'
  )
  metric.incrementCallCount()

  const trans = this.agent.getTransaction()

  const { isValidConfig, failureIdx, quietMode } = validateBrowserMonitoring(
    this.agent.config,
    trans,
    options.allowTransactionlessInjection
  )

  if (!isValidConfig) {
    return _gracefail(failureIdx, quietMode)
  }

  const config = this.agent.config

  // This hash gets written directly into the browser.
  const rumHash = {
    agent: config.browser_monitoring.js_agent_file,
    beacon: config.browser_monitoring.beacon,
    errorBeacon: config.browser_monitoring.error_beacon,
    licenseKey: config.browser_monitoring.browser_key,
    applicationID: config.application_id,

    // we don't use these parameters yet
    agentToken: null
  }

  const hasActiveTransaction = trans !== null

  if (hasActiveTransaction) {
    // bail gracefully outside an ignored transaction
    if (trans.isIgnored()) {
      return _gracefail(1)
    }

    /* If we're in an unnamed transaction, add a friendly warning this is to
     * avoid people going crazy, trying to figure out why browser monitoring is
     * not working when they're missing a transaction name.
     */
    const name = trans.getFullName()
    if (!name) {
      return _gracefail(3)
    }

    const time = trans.timer.getDurationInMillis()
    rumHash.applicationTime = time

    /*
     * Only the first 13 chars of the license should be used for hashing with
     * the transaction name.
     */
    const key = config.license_key.substr(0, 13)
    rumHash.transactionName = hashes.obfuscateNameUsingKey(name, key)

    rumHash.queueTime = trans.queueTime
    rumHash.ttGuid = trans.id

    const attrs = Object.create(null)

    const customAttrs = trans.trace.custom.get(ATTR_DEST.BROWSER_EVENT)
    if (!properties.isEmpty(customAttrs)) {
      attrs.u = customAttrs
    }

    const agentAttrs = trans.trace.attributes.get(ATTR_DEST.BROWSER_EVENT)
    if (!properties.isEmpty(agentAttrs)) {
      attrs.a = agentAttrs
    }

    if (!properties.isEmpty(attrs)) {
      rumHash.atts = hashes.obfuscateNameUsingKey(JSON.stringify(attrs), key)
    }
  } else {
    logger.debug(
      'No transaction detected when generating RUM header, continuing without transaction info'
    )
  }

  // if debugging, do pretty format of JSON
  const tabs = config.browser_monitoring.debug ? 2 : 0
  const json = JSON.stringify(rumHash, null, tabs)

  // the complete header to be written to the browser
  const out = _generateRUMHeader(
    { nonce: options.nonce, hasToRemoveScriptWrapper: options.hasToRemoveScriptWrapper },
    json,
    config.browser_monitoring.js_agent_loader
  )

  logger.trace('generating RUM header', out)

  return out
}

/**
 * @callback startSegmentCallback
 * @param {Function} cb
 *   The function to time with the created segment.
 * @returns {Promise=} Returns a promise if cb returns a promise.
 */

/**
 * Wraps the given handler in a segment which may optionally be turned into a
 * metric.
 *
 * @example
 *  newrelic.startSegment('mySegment', false, function handler() {
 *    // The returned promise here will signify the end of the segment.
 *    return myAsyncTask().then(myNextTask)
 *  })
 * @param {string} name
 *  The name to give the new segment. This will also be the name of the metric.
 * @param {boolean} record
 *  Indicates if the segment should be recorded as a metric. Metrics will show
 *  up on the transaction breakdown table and server breakdown graph. Segments
 *  just show up in transaction traces.
 * @param {startSegmentCallback} handler
 *  The function to track as a segment.
 * @param {Function} [callback]
 *  An optional callback for the handler. This will indicate the end of the
 *  timing if provided.
 * @returns {*} Returns the result of calling `handler`.
 */
API.prototype.startSegment = function startSegment(name, record, handler, callback) {
  this.agent.metrics
    .getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/startSegment')
    .incrementCallCount()

  // Check that we have usable arguments.
  if (!name || typeof handler !== 'function') {
    logger.warn('Name and handler function are both required for startSegment')
    if (typeof handler === 'function') {
      return handler(callback)
    }
    return
  }
  if (callback && typeof callback !== 'function') {
    logger.warn('If using callback, it must be a function')
    return handler(callback)
  }

  // Are we inside a transaction?
  if (!this.shim.getActiveSegment()) {
    logger.debug('startSegment(%j) called outside of a transaction, not recording.', name)
    return handler(callback)
  }

  assignCLMSymbol(this.shim, handler)
  // Create the segment and call the handler.
  const wrappedHandler = this.shim.record(handler, function handlerNamer(shim) {
    return {
      name: name,
      recorder: record ? customRecorder : null,
      callback: callback ? shim.FIRST : null,
      promise: !callback
    }
  })

  return wrappedHandler(callback)
}

/**
 * Creates and starts a web transaction to record work done in
 * the handle supplied. This transaction will run until the handle
 * synchronously returns UNLESS:
 * 1. The handle function returns a promise, where the end of the
 *    transaction will be tied to the end of the promise returned.
 * 2. {@link API#getTransaction} is called in the handle, flagging the
 *    transaction as externally handled.  In this case the transaction
 *    will be ended when {@link TransactionHandle#end} is called in the user's code.
 *
 * @example
 * var newrelic = require('newrelic')
 * newrelic.startWebTransaction('/some/url/path', function() {
 *   var transaction = newrelic.getTransaction()
 *   setTimeout(function() {
 *     // do some work
 *     transaction.end()
 *   }, 100)
 * })
 * @param {string} url
 *  The URL of the transaction.  It is used to name and group related transactions in APM,
 *  so it should be a generic name and not iclude any variable parameters.
 * @param {Function}  handle
 *  Function that represents the transaction work.
 * @returns {null|*} Returns null if handle is not a function, otherwise the return value of handle
 */
API.prototype.startWebTransaction = function startWebTransaction(url, handle) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/startWebTransaction'
  )
  metric.incrementCallCount()

  if (typeof handle !== 'function') {
    logger.warn('startWebTransaction called with a handle arg that is not a function')
    return null
  }

  if (!url) {
    logger.warn('startWebTransaction called without a url, transaction not started')
    return handle()
  }

  logger.debug('starting web transaction %s (%s).', url, handle && handle.name)

  const shim = this.shim
  const tracer = this.agent.tracer
  const parent = tracer.getTransaction()

  assignCLMSymbol(shim, handle)
  return tracer.transactionNestProxy('web', function startWebSegment() {
    const tx = tracer.getTransaction()

    if (!tx) {
      return handle.apply(this, arguments)
    }

    if (tx === parent) {
      logger.debug('not creating nested transaction %s using transaction %s', url, tx.id)
      return tracer.addSegment(url, null, null, true, handle)
    }

    logger.debug(
      'creating web transaction %s (%s) with transaction id: %s',
      url,
      handle && handle.name,
      tx.id
    )
    tx.nameState.setName(NAMES.CUSTOM, null, NAMES.ACTION_DELIMITER, url)
    tx.url = url
    tx.applyUserNamingRules(tx.url)
    tx.baseSegment = tracer.createSegment(url, recordWeb)
    tx.baseSegment.start()

    const boundHandle = tracer.bindFunction(handle, tx.baseSegment)
    maybeAddCLMAttributes(handle, tx.baseSegment)
    let returnResult = boundHandle.call(this)
    if (returnResult && shim.isPromise(returnResult)) {
      returnResult = shim.interceptPromise(returnResult, tx.end.bind(tx))
    } else if (!tx.handledExternally) {
      logger.debug('Ending unhandled web transaction immediately.')
      tx.end()
    }
    return returnResult
  })()
}

API.prototype.startBackgroundTransaction = startBackgroundTransaction

/**
 * Creates and starts a background transaction to record work done in
 * the handle supplied. This transaction will run until the handle
 * synchronously returns UNLESS:
 * 1. The handle function returns a promise, where the end of the
 *    transaction will be tied to the end of the promise returned.
 * 2. {@link API#getTransaction} is called in the handle, flagging the
 *    transaction as externally handled.  In this case the transaction
 *    will be ended when {@link TransactionHandle#end} is called in the user's code.
 *
 * @example
 * var newrelic = require('newrelic')
 * newrelic.startBackgroundTransaction('Red October', 'Subs', function() {
 *   var transaction = newrelic.getTransaction()
 *   setTimeout(function() {
 *     // do some work
 *     transaction.end()
 *   }, 100)
 * })
 * @param {string} name
 *  The name of the transaction. It is used to name and group related
 *  transactions in APM, so it should be a generic name and not iclude any
 *  variable parameters.
 * @param {string} [group]
 *  Optional, used for grouping background transactions in APM. For more
 *  information see:
 *  https://docs.newrelic.com/docs/apm/applications-menu/monitoring/transactions-page#txn-type-dropdown
 * @param {Function} handle
 *  Function that represents the background work.
 * @memberof API#
 * @returns {null|*} Returns null if handle is not a function, otherwise the return value of handle
 */
function startBackgroundTransaction(name, group, handle) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/startBackgroundTransaction'
  )
  metric.incrementCallCount()

  if (handle === undefined && typeof group === 'function') {
    handle = group
    group = 'Nodejs'
  }

  if (typeof handle !== 'function') {
    logger.warn('startBackgroundTransaction called with a handle that is not a function')
    return null
  }

  if (!name) {
    logger.warn('startBackgroundTransaction called without a name')
    return handle()
  }

  logger.debug('starting background transaction %s:%s (%s)', name, group, handle && handle.name)

  const tracer = this.agent.tracer
  const shim = this.shim
  const txName = group + '/' + name
  const parent = tracer.getTransaction()

  assignCLMSymbol(shim, handle)
  return tracer.transactionNestProxy('bg', function startBackgroundSegment() {
    const tx = tracer.getTransaction()

    if (!tx) {
      return handle.apply(this, arguments)
    }

    if (tx === parent) {
      logger.debug('not creating nested transaction %s using transaction %s', txName, tx.id)
      return tracer.addSegment(txName, null, null, true, handle)
    }

    logger.debug(
      'creating background transaction %s:%s (%s) with transaction id: %s',
      name,
      group,
      handle && handle.name,
      tx.id
    )

    tx._partialName = txName
    tx.baseSegment = tracer.createSegment(name, recordBackground)
    tx.baseSegment.partialName = group
    tx.baseSegment.start()

    const boundHandle = tracer.bindFunction(handle, tx.baseSegment)
    maybeAddCLMAttributes(handle, tx.baseSegment)
    let returnResult = boundHandle.call(this)
    if (returnResult && shim.isPromise(returnResult)) {
      returnResult = shim.interceptPromise(returnResult, tx.end.bind(tx))
    } else if (!tx.handledExternally) {
      logger.debug('Ending unhandled background transaction immediately.')
      tx.end()
    }
    return returnResult
  })()
}

/**
 * End the current web or background custom transaction. This method requires being in
 * the correct transaction context when called.
 */
API.prototype.endTransaction = function endTransaction() {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/endTransaction')
  metric.incrementCallCount()

  const tracer = this.agent.tracer
  const tx = tracer.getTransaction()

  if (tx) {
    if (tx.baseSegment) {
      if (tx.type === 'web') {
        tx.finalizeNameFromUri(tx.url, 0)
      }
      tx.baseSegment.end()
    }
    tx.end()
    logger.debug('ended transaction with id: %s and name: %s', tx.id, tx.name)
  } else {
    logger.debug('endTransaction() called while not in a transaction.')
  }
}

/**
 * Record a custom metric, usually associated with a particular duration.
 * The `name` must be a string following standard metric naming rules. The `value` will
 * usually be a number, but it can also be an object.
 *   When `value` is a numeric value, it should represent the magnitude of a measurement
 *     associated with an event; for example, the duration for a particular method call.
 *   When `value` is an object, it must contain count, total, min, max, and sumOfSquares
 *     keys, all with number values. This form is useful to aggregate metrics on your own
 *     and report them periodically; for example, from a setInterval. These values will
 *     be aggregated with any previously collected values for the same metric. The names
 *     of these keys match the names of the keys used by the platform API.
 *
 * @param  {string} name  The name of the metric.
 * @param  {number|object} value The value of the metric to record
 */
API.prototype.recordMetric = function recordMetric(name, value) {
  const supportMetric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/recordMetric'
  )
  supportMetric.incrementCallCount()

  if (typeof name !== 'string') {
    logger.warn('Metric name must be a string')
    return
  }

  const metricName = NAMES.CUSTOM + NAMES.ACTION_DELIMITER + name
  const metric = this.agent.metrics.getOrCreateMetric(metricName)

  if (typeof value === 'number') {
    metric.recordValue(value)
    return
  }

  if (typeof value !== 'object') {
    logger.warn('Metric value must be either a number, or a metric object')
    return
  }

  const stats = Object.create(null)
  const required = ['count', 'total', 'min', 'max', 'sumOfSquares']
  const keyMap = { count: 'callCount' }

  for (let i = 0, l = required.length; i < l; ++i) {
    if (typeof value[required[i]] !== 'number') {
      logger.warn('Metric object must include %s as a number', required[i])
      return
    }

    const key = keyMap[required[i]] || required[i]
    stats[key] = value[required[i]]
  }

  if (typeof value.totalExclusive === 'number') {
    stats.totalExclusive = value.totalExclusive
  } else {
    stats.totalExclusive = value.total
  }

  metric.merge(stats)
}

/**
 * Create or update a custom metric that acts as a simple counter.
 * The count of the given metric will be incremented by the specified amount,
 * defaulting to 1.
 *
 * @param  {string} name  The name of the metric.
 * @param  {number} [value] The amount that the count of the metric should be incremented
 *                          by. Defaults to 1.
 */
API.prototype.incrementMetric = function incrementMetric(name, value) {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/incrementMetric')
  metric.incrementCallCount()

  if (!value && value !== 0) {
    value = 1
  }

  if (typeof value !== 'number' || value % 1 !== 0) {
    logger.warn('Metric Increment value must be an integer')
    return
  }

  this.recordMetric(name, {
    count: value,
    total: 0,
    min: 0,
    max: 0,
    sumOfSquares: 0
  })
}

/**
 * Record custom event data which can be queried in New Relic Insights.
 *
 * @param  {string} eventType  The name of the event. It must be an alphanumeric string
 *                             less than 255 characters.
 * @param  {object} attributes Object of key and value pairs. The keys must be shorter
 *                             than 255 characters, and the values must be string, number,
 *                             or boolean.
 * @returns {false|undefined} Returns false explicitly if failed/disabled, otherwise undefined
 */
API.prototype.recordCustomEvent = function recordCustomEvent(eventType, attributes) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/recordCustomEvent'
  )
  metric.incrementCallCount()

  // If high security mode is on, custom events are disabled.
  if (this.agent.config.high_security) {
    logger.warnOnce('Custom Event', 'Custom events are disabled by high security mode.')
    return false
  } else if (!this.agent.config.api.custom_events_enabled) {
    logger.debug('Config.api.custom_events_enabled set to false, not collecting value')
    return false
  }

  if (!this.agent.config.custom_insights_events.enabled) {
    return
  }
  // Check all the arguments before bailing to give maximum information in a
  // single invocation.
  let fail = false

  if (!eventType || typeof eventType !== 'string') {
    logger.warn(
      'recordCustomEvent requires a string for its first argument, got %s (%s)',
      stringify(eventType),
      typeof eventType
    )
    fail = true
  } else if (!CUSTOM_EVENT_TYPE_REGEX.test(eventType)) {
    logger.warn(
      'recordCustomEvent eventType of %s is invalid, it must match /%s/',
      eventType,
      CUSTOM_EVENT_TYPE_REGEX.source
    )
    fail = true
  } else if (eventType.length > 255) {
    logger.warn(
      'recordCustomEvent eventType must have a length less than 256, got %s (%s)',
      eventType,
      eventType.length
    )
    fail = true
  }
  // If they don't pass an attributes object, or the attributes argument is not
  // an object, or if it is an object but is actually an array, log a
  // warning and set the fail bit.
  if (isSimpleObject(attributes) === false) {
    logger.warn(
      'recordCustomEvent requires an object for its second argument, got %s (%s)',
      stringify(attributes),
      typeof attributes
    )
    fail = true
  } else if (_checkKeyLength(attributes, 255)) {
    fail = true
  }

  if (fail) {
    return
  }

  // Filter all object type valued attributes out
  const filteredAttributes = _filterAttributes(attributes, `${eventType} custom event`)

  const instrinics = {
    type: eventType,
    timestamp: Date.now()
  }

  const tx = this.agent.getTransaction()
  const priority = (tx && tx.priority) || Math.random()
  this.agent.customEventAggregator.add([instrinics, filteredAttributes], priority)
}

/**
 * Registers an instrumentation function.
 *
 *  - `newrelic.instrument(moduleName, onRequire [,onError])`
 *  - `newrelic.instrument(options)`
 *
 * @param {string|object} moduleName The module name given to require to load the module, or the instrumentation specification
 * @param {string} moduleName.moduleName The module name given to require to load the module
 * @param {Function}  moduleName.onResolved The function to call prior to module load after the filepath has been resolved
 * @param {Function}  moduleName.onRequire The function to call when the module has been loaded
 * @param {Function} [moduleName.onError] If provided, should `onRequire` throw an error, the error will be passed to
 * @param {Function} onRequire The function to call when the module has been loaded
 * @param {Function} onError If provided, should `onRequire` throw an error, the error will be passed to this function.
 */
API.prototype.instrument = function instrument(moduleName, onRequire, onError) {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/instrument')
  metric.incrementCallCount()

  let opts = moduleName
  if (typeof opts === 'string') {
    opts = {
      moduleName: moduleName,
      onRequire: onRequire,
      onError: onError
    }
  }

  opts.type = MODULE_TYPE.GENERIC
  shimmer.registerInstrumentation(opts)
}

/**
 * Registers an instrumentation function.
 *
 * - `newrelic.instrumentConglomerate(moduleName, onRequire [, onError])`
 * - `newrelic.isntrumentConglomerate(options)`
 *
 * @param {string|object} moduleName The module name given to require to load the module, or the instrumentation specification
 * @param {string} moduleName.moduleName The module name given to require to load the module
 * @param {Function}  moduleName.onResolved The function to call prior to module load after the filepath has been resolved
 * @param {Function}  moduleName.onRequire The function to call when the module has been loaded
 * @param {Function} [moduleName.onError] If provided, should `onRequire` throw an error, the error will be passed to
 * @param {Function} onRequire The function to call when the module has been loaded
 * @param {Function} onError If provided, should `onRequire` throw an error, the error will be passed to this function.
 */
API.prototype.instrumentConglomerate = function instrumentConglomerate(
  moduleName,
  onRequire,
  onError
) {
  this.agent.metrics
    .getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/instrumentConglomerate')
    .incrementCallCount()

  let opts = moduleName
  if (typeof opts === 'string') {
    opts = { moduleName, onRequire, onError }
  }

  opts.type = MODULE_TYPE.CONGLOMERATE
  shimmer.registerInstrumentation(opts)
}

/**
 * Registers an instrumentation function.
 *
 *  - `newrelic.instrumentDatastore(moduleName, onRequire [,onError])`
 *  - `newrelic.instrumentDatastore(options)`
 *
 * @param {string|object} moduleName The module name given to require to load the module, or the instrumentation specification
 * @param {string} moduleName.moduleName The module name given to require to load the module
 * @param {Function}  moduleName.onResolved The function to call prior to module load after the filepath has been resolved
 * @param {Function}  moduleName.onRequire The function to call when the module has been loaded
 * @param {Function} [moduleName.onError] If provided, should `onRequire` throw an error, the error will be passed to
 * @param {Function} onRequire The function to call when the module has been loaded
 * @param {Function} onError If provided, should `onRequire` throw an error, the error will be passed to this function.
 */
API.prototype.instrumentDatastore = function instrumentDatastore(moduleName, onRequire, onError) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/instrumentDatastore'
  )
  metric.incrementCallCount()

  let opts = moduleName
  if (typeof opts === 'string') {
    opts = {
      moduleName: moduleName,
      onRequire: onRequire,
      onError: onError
    }
  }

  opts.type = MODULE_TYPE.DATASTORE
  shimmer.registerInstrumentation(opts)
}

/**
 * Registers an instrumentation function.
 *
 *  - `newrelic.instrumentWebframework(moduleName, onRequire [,onError])`
 *  - `newrelic.instrumentWebframework(options)`
 *
 * @param {string|object} moduleName The module name given to require to load the module, or the instrumentation specification
 * @param {string} moduleName.moduleName The module name given to require to load the module
 * @param {Function}  moduleName.onResolved The function to call prior to module load after the filepath has been resolved
 * @param {Function}  moduleName.onRequire The function to call when the module has been loaded
 * @param {Function} [moduleName.onError] If provided, should `onRequire` throw an error, the error will be passed to
 * @param {Function} onRequire The function to call when the module has been loaded
 * @param {Function} onError If provided, should `onRequire` throw an error, the error will be passed to this function.
 */
API.prototype.instrumentWebframework = function instrumentWebframework(
  moduleName,
  onRequire,
  onError
) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/instrumentWebframework'
  )
  metric.incrementCallCount()

  let opts = moduleName
  if (typeof opts === 'string') {
    opts = {
      moduleName: moduleName,
      onRequire: onRequire,
      onError: onError
    }
  }

  opts.type = MODULE_TYPE.WEB_FRAMEWORK
  shimmer.registerInstrumentation(opts)
}

/**
 * Registers an instrumentation function for instrumenting message brokers.
 *
 *  - `newrelic.instrumentMessages(moduleName, onRequire [,onError])`
 *  - `newrelic.instrumentMessages(options)`
 *
 * @param {string|object} moduleName The module name given to require to load the module, or the instrumentation specification
 * @param {string} moduleName.moduleName The module name given to require to load the module
 * @param {Function}  moduleName.onResolved The function to call prior to module load after the filepath has been resolved
 * @param {Function}  moduleName.onRequire The function to call when the module has been loaded
 * @param {Function} [moduleName.onError] If provided, should `onRequire` throw an error, the error will be passed to
 * @param {Function} onRequire The function to call when the module has been loaded
 * @param {Function} onError If provided, should `onRequire` throw an error, the error will be passed to this function.
 */
API.prototype.instrumentMessages = function instrumentMessages(moduleName, onRequire, onError) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/instrumentMessages'
  )
  metric.incrementCallCount()

  let opts = moduleName
  if (typeof opts === 'string') {
    opts = {
      moduleName: moduleName,
      onRequire: onRequire,
      onError: onError
    }
  }

  opts.type = MODULE_TYPE.MESSAGE
  shimmer.registerInstrumentation(opts)
}

/**
 * Applies an instrumentation to an already loaded CommonJs module.
 *
 * Note: This function will not work for ESM packages.
 *
 *    // oh no, express was loaded before newrelic
 *    const express   = require('express')
 *    const newrelic  = require('newrelic')
 *
 *    // phew, we can use instrumentLoadedModule to make
 *    // sure express is still instrumented
 *    newrelic.instrumentLoadedModule('express', express)
 *
 * @param {string} moduleName
 *  The module's name/identifier.  Will be normalized
 *  into an instrumentation key.
 * @param {object} module
 *  The actual module object or function we're instrumenting
 * @returns {boolean} Whether or not the module was successfully instrumented
 */
API.prototype.instrumentLoadedModule = function instrumentLoadedModule(moduleName, module) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/instrumentLoadedModule'
  )
  metric.incrementCallCount()

  try {
    const resolvedName = require.resolve(moduleName)
    const parsed = parse(resolvedName)

    return shimmer.instrumentPostLoad(this.agent, module, moduleName, parsed.basedir)
  } catch (error) {
    logger.error('instrumentLoadedModule encountered an error, module not instrumented: %s', error)
  }

  return false
}

/**
 * Returns the current trace and span id.
 *
 * @returns {*} The object containing the current trace and span ids
 */
API.prototype.getTraceMetadata = function getTraceMetadata() {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/getTraceMetadata'
  )
  metric.incrementCallCount()

  const metadata = {}

  const segment = this.agent.tracer.getSegment()
  if (!segment) {
    logger.debug('No transaction found when calling API#getTraceMetadata')
  } else if (!this.agent.config.distributed_tracing.enabled) {
    logger.debug('Distributed tracing disabled when calling API#getTraceMetadata')
  } else {
    metadata.traceId = segment.transaction.traceId

    const spanId = segment.getSpanId()
    if (spanId) {
      metadata.spanId = spanId
    }
  }

  return metadata
}

/**
 * Get a set of tracked identifiers
 *
 * @param {object} params Input parameters.
 * @param {string} params.responseId The LLM generated identifier for the
 * response.
 * @returns {LlmTrackedIds|undefined} The tracked identifiers.
 */
API.prototype.getLlmMessageIds = function getLlmMessageIds({ responseId } = {}) {
  this.agent.metrics
    .getOrCreateMetric(`${NAMES.SUPPORTABILITY.API}/getLlmMessageIds`)
    .incrementCallCount()

  if (this.agent.config?.ai_monitoring?.enabled !== true) {
    logger.warn('getLlmMessageIds invoked but ai_monitoring is disabled.')
    return
  }

  const tx = this.agent.tracer.getTransaction()
  if (!tx) {
    logger.warn('getLlmMessageIds must be called within the scope of a transaction.')
    return
  }
  return tx.llm.responses.get(responseId)
}

/**
 * Record a LLM feedback event which can be viewed in New Relic API Monitoring.
 *
 * @param {object} params Input parameters.
 * @param {string} [params.conversationId=""] If available, the unique
 * identifier for the LLM conversation that triggered the event.
 * @param {string} [params.requestId=""] If available, the request identifier
 * from the remote service.
 * @param {string} params.messageId Identifier for the message being rated.
 * Obtained from {@link getLlmMessageIds}.
 * @param {string} params.category A tag for the event.
 * @param {string} params.rating A indicator of how useful the message was.
 * @param {string} [params.message=""] The message that triggered the event.
 * @param {object} [params.metadata={}] Additional key-value pairs to associate
 * with the recorded event.
 */
API.prototype.recordLlmFeedbackEvent = function recordLlmFeedbackEvent({
  conversationId = '',
  requestId = '',
  messageId,
  category,
  rating,
  message = '',
  metadata = {}
} = {}) {
  this.agent.metrics
    .getOrCreateMetric(`${NAMES.SUPPORTABILITY.API}/recordLlmFeedbackEvent`)
    .incrementCallCount()

  if (this.agent.config?.ai_monitoring?.enabled !== true) {
    logger.warn('recordLlmFeedbackEvent invoked but ai_monitoring is disabled.')
    return
  }

  const tx = this.agent.tracer.getTransaction()
  if (!tx) {
    logger.warn(
      'No message feedback events will be recorded. recordLlmFeedbackEvent must be called within the scope of a transaction.'
    )
    return
  }

  const feedback = new LlmFeedbackMessage({
    conversationId,
    requestId,
    messageId,
    category,
    rating,
    message
  })
  this.recordCustomEvent('LlmFeedbackMessage', { ...metadata, ...feedback })
}

/**
 * Shuts down the agent.
 *
 * @param {object} [options]
 *  Object with shut down options.
 * @param {boolean} [options.collectPendingData=false]
 *  If true, the agent will send any pending data to the collector before
 *  shutting down.
 * @param {number} [options.timeout=0]
 *  Time in milliseconds to wait before shutting down.
 * @param {boolean} [options.waitForIdle=false]
 *  If true, the agent will not shut down until there are no active transactions.
 * @param {Function} [cb]
 *  Callback function that runs when agent stops.
 */
API.prototype.shutdown = function shutdown(options, cb) {
  this.agent.metrics.getOrCreateMetric(`${NAMES.SUPPORTABILITY.API}/shutdown`).incrementCallCount()

  let callback = cb
  if (typeof options === 'function') {
    // shutdown(cb)
    callback = options
    options = {}
  } else if (typeof callback !== 'function') {
    // shutdown([options])
    callback = () => {}
  }
  if (!options) {
    // shutdown(null, cb)
    options = {}
  }

  _doShutdown(this, options, callback)
}

/**
 * Helper function for logging if an error occurs, and where
 *
 * @param {Error} error If defined, the error that occurred
 * @param {string} phase Where in the process the error happened
 * @returns {void}
 */
function _logErrorCallback(error, phase) {
  if (error) {
    logger.error(error, `An error occurred during ${phase}`)
  }
}

/**
 * Function for handling the graceful shutdown process, including processing of data and handling errors
 *
 * @param {object} api instantiation of this file
 * @param {object} options shutdown options object
 * @param {boolean} [options.collectPendingData=false]
 *  If true, the agent will send any pending data to the collector before
 *  shutting down.
 * @param {number} [options.timeout=0]
 *  Time in milliseconds to wait before shutting down.
 * @param {boolean} [options.waitForIdle=false]
 *  If true, the agent will not shut down until there are no active transactions.
 * @param {Function} callback callback function to execute after shutdown process is complete (successful or not)
 */
function _doShutdown(api, options, callback) {
  const agent = api.agent

  // If we need to wait for idle and there are currently active transactions,
  // listen for transactions ending and check if we're ready to go.
  if (options.waitForIdle && agent.activeTransactions) {
    options.waitForIdle = false // To prevent recursive waiting.
    agent.on('transactionFinished', function onTransactionFinished() {
      if (agent.activeTransactions === 0) {
        setImmediate(_doShutdown, api, options, callback)
      }
    })
    return
  }

  /**
   * Callback function for after harvest cycles happen as part of shutdown process
   *
   * @param {Error} error If defined, the error that occurred during harvest
   */
  function afterHarvest(error) {
    _logErrorCallback(error, 'last harvest before shutdown')
    agent.stop(callback)
  }

  if (options.collectPendingData && agent._state !== 'started') {
    if (typeof options.timeout === 'number') {
      setTimeout(function shutdownTimeout() {
        agent.stop(callback)
      }, options.timeout).unref()
    } else if (options.timeout) {
      logger.warn('options.timeout should be of type "number". Got %s', typeof options.timeout)
    }

    agent.on('started', function shutdownHarvest() {
      agent.forceHarvestAll(afterHarvest)
    })

    agent.on('errored', function logShutdownError(error) {
      _logErrorCallback(error, 'after shutdown')
      agent.stop(callback)
    })
  } else if (options.collectPendingData) {
    agent.forceHarvestAll(afterHarvest)
  } else {
    agent.stop(callback)
  }
}

/**
 * Validates that all keys in a given object have values that are less than or equal to a given length
 * Assumes all values have .length property (string/array)
 *
 * @param {object} object The object to validate
 * @param {number} maxLength The max allowed length
 * @returns {boolean} Whether or not the object passes validation
 */
function _checkKeyLength(object, maxLength) {
  const keys = Object.keys(object)
  let badKey = false
  const len = keys.length
  let key = '' // init to string because gotta go fast
  for (let i = 0; i < len; i++) {
    key = keys[i]
    if (key.length > maxLength) {
      logger.warn(
        'recordCustomEvent requires keys to be less than 256 chars got %s (%s)',
        key,
        key.length
      )
      badKey = true
    }
  }
  return badKey
}

API.prototype.setLambdaHandler = function setLambdaHandler(handler) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/setLambdaHandler'
  )
  metric.incrementCallCount()

  return this.awsLambda.patchLambdaHandler(handler)
}

/**
 * Obfuscates SQL for a given database engine.
 *
 * @param {string} sql sql statement
 * @param {string} dialect engine of the sql (mysql, postgres, cassandra, oracle)
 * @returns {string} sql that obfuscates raw values
 */
API.prototype.obfuscateSql = function obfuscateSql(sql, dialect) {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/obfuscateSql')
  metric.incrementCallCount()

  return obfuscate(sql, dialect)
}

/**
 * Assigns `enduser.id` attribute on transaction and trace events. It will also
 * assign the attribute to errors if they occur within a transaction.
 *
 * @param {string} id a unique identifier used to set the `enduser.id` attribute
 */
API.prototype.setUserID = function setUserID(id) {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/setUserID')
  metric.incrementCallCount()

  const transaction = this.agent.tracer.getTransaction()

  if (!(id && transaction)) {
    logger.warn(
      'User id is empty or not in a transaction, not assigning `enduser.id` attribute to transaction events, trace events, and/or errors.'
    )
    return
  }

  transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'enduser.id', id)
}

/**
 * Function for removing invalid attribute key/value pairs from an object
 *
 * @param {object} attributes The attribute object
 * @param {string} name Caller name, used for debugging/logging purposes only
 * @returns {object} Attribute object containing only valid key/value pairs
 */
function _filterAttributes(attributes, name) {
  const filteredAttributes = Object.create(null)
  Object.keys(attributes).forEach((attributeKey) => {
    if (!isValidType(attributes[attributeKey])) {
      logger.info(
        `Omitting attribute ${attributeKey} from ${name} call, type must ` +
          'be boolean, number, or string'
      )
      return
    }
    filteredAttributes[attributeKey] = attributes[attributeKey]
  })
  return filteredAttributes
}

/**
 * Function for adding a custom callback to generate Error Group names, which
 * will be used by the Errors Inbox to group similar errors together via the `error.group.name`
 * agent attribute.
 *
 * Provided functions must return a string, and receive an object as an argument,
 * which contains information related to the Error that occurred, and has the
 * following format:
 *
 * ```
 * {
 *   customAttributes: object,
 *   'request.uri': string,
 *   'http.statusCode': string,
 *   'http.method': string,
 *   error: Error,
 *   'error.expected': boolean
 * }
 * ```
 *
 * Calling this function multiple times will replace previously defined functions
 *
 * @param {Function} callback - callback function to generate `error.group.name` attribute
 * @example
 * function myCallback(metadata) {
 *   if (metadata['http.statusCode'] === '400') {
 *     return 'Bad User Input'
 *   }
 * }
 * newrelic.setErrorGroupCallback(myCallback)
 */
API.prototype.setErrorGroupCallback = function setErrorGroupCallback(callback) {
  const metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/setErrorGroupCallback'
  )
  metric.incrementCallCount()

  if (!this.shim.isFunction(callback) || this.shim.isPromise(callback)) {
    logger.warn(
      'Error Group callback must be a synchronous function, Error Group attribute will not be added'
    )
    return
  }

  this.agent.errors.errorGroupCallback = callback
}

/**
 * Function for assigning metadata to all LLM events. This should only
 * be called once in your application and before executing any openai, bedrock,
 * langchain, generative AI methods.
 *
 * If passing in metadata via `api.recordLlmFeedbackEvent`, it will take precedence
 * over what is assigned via this method.
 *
 * @param {object} metadata key/value metadata to be assigned to all LLM Events on creation
 * @example
 * newrelic.setLlmMetadata({ type: 'openai', framework: 'express', region: 'us' })
 */
API.prototype.setLlmMetadata = function setLlmMetadata(metadata) {
  const metric = this.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/setLlmMetadata')
  metric.incrementCallCount()

  if (!isSimpleObject(metadata)) {
    logger.warn('metadata must be an object, not assigning LLM metadata.')
    return
  }

  this.agent.llm.metadata = metadata
}

module.exports = API
