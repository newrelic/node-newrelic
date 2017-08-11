'use strict'

var arity = require('./lib/util/arity')
var util = require('util')
var logger = require('./lib/logger').child({component: 'api'})
var NAMES = require('./lib/metrics/names')
var recordWeb = require('./lib/metrics/recorders/http.js')
var recordBackground = require('./lib/metrics/recorders/other.js')
var customRecorder = require('./lib/metrics/recorders/custom')
var hashes = require('./lib/util/hashes')
var properties = require('./lib/util/properties')
var stringify = require('json-stringify-safe')
var shimmer = require('./lib/shimmer.js')
var Shim = require('./lib/shim/shim.js')
var TransactionHandle = require('./lib/transaction/handle.js')

var MODULE_TYPE = require('./lib/shim/constants').MODULE_TYPE

/*
 *
 * CONSTANTS
 *
 */
var RUM_STUB = "<script type='text/javascript'>window.NREUM||(NREUM={});" +
                "NREUM.info = %s; %s</script>"

// these messages are used in the _gracefail() method below in getBrowserTimingHeader
var RUM_ISSUES = [
  'NREUM: no browser monitoring headers generated; disabled',
  'NREUM: transaction missing while generating browser monitoring headers',
  'NREUM: config.browser_monitoring missing, something is probably wrong',
  'NREUM: browser_monitoring headers need a transaction name',
  'NREUM: browser_monitoring requires valid application_id',
  'NREUM: browser_monitoring requires valid browser_key',
  'NREUM: browser_monitoring requires js_agent_loader script',
  'NREUM: browser_monitoring disabled by browser_monitoring.loader config'
]

// can't overwrite internal parameters or all heck will break loose
var CUSTOM_BLACKLIST = [
  'nr_flatten_leading'
]

var CUSTOM_EVENT_TYPE_REGEX = /^[a-zA-Z0-9:_ ]+$/

/**
 * The exported New Relic API. This contains all of the functions meant to be
 * used by New Relic customers. For now, that means transaction naming.
 *
 * You do not need to directly instantiate this class, as an instance of this is
 * the return from `require('newrelic')`.
 *
 * @constructor
 */
function API(agent) {
  this.agent = agent
  this.shim = new Shim(agent, 'NewRelicAPI')
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
 */
API.prototype.setTransactionName = function setTransactionName(name) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/setTransactionName'
  )
  metric.incrementCallCount()

  var transaction = this.agent.tracer.getTransaction()
  if (!transaction) {
    return logger.warn("No transaction found when setting name to '%s'.", name)
  }

  if (!name) {
    if (transaction && transaction.url) {
      logger.error("Must include name in setTransactionName call for URL %s.",
                   transaction.url)
    } else {
      logger.error("Must include name in setTransactionName call.")
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
 * @returns {TransactionHandle} transaction The transaction object with the `end`
 *                               and `ignore` methods on it.
 */
API.prototype.getTransaction = function getTransaction() {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/getTransaction'
  )
  metric.incrementCallCount()

  var transaction = this.agent.tracer.getTransaction()
  if (!transaction) {
    logger.debug("No transaction found when calling API#getTransaction")
    return TransactionHandle.stub
  }

  transaction.handledExternally = true

  return new TransactionHandle(transaction)
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
 *
 * @param {string} [version] The dispatcher version you would like to
 *                           report to New Relic
 */
API.prototype.setDispatcher = function setDispatcher(name, version) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/setDispatcher'
  )
  metric.incrementCallCount()

  if (!name || typeof name !== 'string') {
    logger.error("setDispatcher must be called with a name, and name must be a string.")
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
 */
API.prototype.setControllerName = function setControllerName(name, action) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/setControllerName'
  )
  metric.incrementCallCount()

  var transaction = this.agent.tracer.getTransaction()
  if (!transaction) {
    return logger.warn("No transaction found when setting controller to %s.", name)
  }

  if (!name) {
    if (transaction && transaction.url) {
      logger.error("Must include name in setControllerName call for URL %s.",
                   transaction.url)
    } else {
      logger.error("Must include name in setControllerName call.")
    }

    return
  }

  action = action || transaction.verb || 'GET'
  transaction.forceName = NAMES.CONTROLLER + '/' + name + '/' + action
}

/**
 * Add a custom parameter to the current transaction. Some parameters are
 * reserved (see CUSTOM_BLACKLIST for the current, very short list), and
 * as with most API methods, this must be called in the context of an
 * active transaction. Most recently set value wins.
 *
 * @param {string} name  The name you want displayed in the RPM UI.
 * @param {string} value The value you want displayed. Must be serializable.
 */
API.prototype.addCustomParameter = function addCustomParameter(name, value) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/addCustomParameter'
  )
  metric.incrementCallCount()

  // If high security mode is on, custom params are disabled.
  if (this.agent.config.high_security === true) {
    logger.warnOnce(
      "Custom params",
      "Custom parameters are disabled by high security mode."
    )
    return false
  } else if (!this.agent.config.api.custom_parameters_enabled) {
    logger.debug(
      "Config.api.custom_parameters_enabled set to false, not collecting value"
    )
    return false
  }

  var ignored = this.agent.config.ignored_params || []

  var transaction = this.agent.tracer.getTransaction()
  if (!transaction) {
    return logger.warn("No transaction found for custom parameters.")
  }

  var trace = transaction.trace
  if (!trace.custom) {
    return logger.warn(
      "Couldn't add parameter %s to nonexistent custom parameters.",
      name
    )
  }

  if (CUSTOM_BLACKLIST.indexOf(name) !== -1) {
    return logger.warn("Not overwriting value of NR-only parameter %s.", name)
  }

  if (ignored.indexOf(name) !== -1) {
    return logger.warn("Not setting ignored parameter name %s.", name)
  }

  if (name in trace.custom) {
    logger.debug(
      "Changing custom parameter %s from %s to %s.",
      name,
      trace.custom[name],
      value
    )
  }

  trace.custom[name] = value
}

/**
 * Adds all custom parameters in an object to the current transaction.
 *
 * See documentation for newrelic.addCustomParameter for more information on
 * setting custom parameters.
 *
 * An example of setting a custom parameter object:
 *
 *    newrelic.addCustomParameters({test: 'value', test2: 'value2'});
 *
 * @param {object} [params]
 * @param {string} [params.KEY] The name you want displayed in the RPM UI.
 * @param {string} [params.KEY.VALUE] The value you want displayed. Must be serializable.
 */
API.prototype.addCustomParameters = function addCustomParameters(params) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/addCustomParameters'
  )
  metric.incrementCallCount()

  for (var key in params) {
    if (!properties.hasOwn(params, key)) {
      continue
    }

    this.addCustomParameter(key, params[key])
  }
}

/**
 * Tell the tracer whether to ignore the current transaction. The most common
 * use for this will be to mark a transaction as ignored (maybe it's handling
 * a websocket polling channel, or maybe it's an external call you don't care
 * is slow), but it's also useful when you want a transaction that would
 * otherwise be ignored due to URL or transaction name normalization rules
 * to *not* be ignored.
 *
 * @param {boolean} ignored Ignore, or don't ignore, the current transaction.
 */
API.prototype.setIgnoreTransaction = function setIgnoreTransaction(ignored) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/setIgnoreTransaction'
  )
  metric.incrementCallCount()

  var transaction = this.agent.tracer.getTransaction()
  if (!transaction) {
    return logger.warn("No transaction found to ignore.")
  }

  transaction.setForceIgnore(ignored)
}

/**
 * Send errors to New Relic that you've already handled yourself. Should be an
 * `Error` or one of its subtypes, but the API will handle strings and objects
 * that have an attached `.message` or `.stack` property.
 *
 * NOTE: Errors that are recorded using this method do _not_ obey the
 * `ignore_status_codes` configuration.
 *
 * @param {Error} error
 *  The error to be traced.
 *
 * @param {object} [customParameters]
 *  Optional. Any custom parameters to be displayed in the New Relic UI.
 */
API.prototype.noticeError = function noticeError(error, customParameters) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/noticeError'
  )
  metric.incrementCallCount()

  // If high security mode is on, noticeError is disabled.
  if (this.agent.config.high_security === true) {
    logger.warnOnce(
      "Notice Error",
      "Notice error API are disabled by high security mode."
    )
    return false
  } else if (!this.agent.config.api.notice_error_enabled) {
    logger.debug(
      "Config.api.notice_error_enabled set to false, not collecting error"
    )
    return false
  }

  if (typeof error === 'string') error = new Error(error)
  var transaction = this.agent.tracer.getTransaction()

  this.agent.errors.addUserError(transaction, error, customParameters)
}

/**
 * If the URL for a transaction matches the provided pattern, name the
 * transaction with the provided name. If there are capture groups in the
 * pattern (which is a standard JavaScript regular expression, and can be
 * passed as either a RegExp or a string), then the substring matches ($1, $2,
 * etc.) are replaced in the name string. BE CAREFUL WHEN USING SUBSTITUTION.
 * If the replacement substrings are highly variable (i.e. are identifiers,
 * GUIDs, or timestamps), the rule will generate too many metrics and
 * potentially get your application blacklisted by New Relic.
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
 */
API.prototype.addNamingRule = function addNamingRule(pattern, name) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/addNamingRule'
  )
  metric.incrementCallCount()


  if (!name) return logger.error("Simple naming rules require a replacement name.")

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
 */
API.prototype.addIgnoringRule = function addIgnoringRule(pattern) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/addIgnoringRule'
  )
  metric.incrementCallCount()

  if (!pattern) return logger.error("Must include a URL pattern to ignore.")

  this.agent.userNormalizer.addSimple(pattern, null)
}

/**
 * Get the <script>...</script> header necessary for Browser Monitoring
 * This script must be manually injected into your templates, as high as possible
 * in the header, but _after_ any X-UA-COMPATIBLE HTTP-EQUIV meta tags.
 * Otherwise you may hurt IE!
 *
 * This method must be called _during_ a transaction, and must be called every
 * time you want to generate the headers.
 *
 * Do *not* reuse the headers between users, or even between requests.
 *
 * @returns {string} The `<script>` header to be injected.
 */
API.prototype.getBrowserTimingHeader = function getBrowserTimingHeader() {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/getBrowserTimingHeader'
  )
  metric.incrementCallCount()

  var config = this.agent.config

  /**
   * Gracefully fail.
   *
   * Output an HTML comment and log a warning the comment is meant to be
   * innocuous to the end user.
   *
   * @param {number} num          - Error code from `RUM_ISSUES`.
   * @param {bool} [quite=false]  - Be quiet about this failure.
   *
   * @see RUM_ISSUES
   */
  function _gracefail(num, quiet) {
    if (quiet) {
      logger.debug(RUM_ISSUES[num])
    } else {
      logger.warn(RUM_ISSUES[num])
    }
    return '<!-- NREUM: (' + num + ') -->'
  }

  var browser_monitoring = config.browser_monitoring

  // config.browser_monitoring should always exist, but we don't want the agent
  // to bail here if something goes wrong
  if (!browser_monitoring) return _gracefail(2)

  /* Can control header generation with configuration this setting is only
   * available in the newrelic.js config file, it is not ever set by the
   * server.
   */
  if (!browser_monitoring.enable) {
    // It has been disabled by the user; no need to warn them about their own
    // settings so fail quietly and gracefully.
    return _gracefail(0, true)
  }

  var trans = this.agent.getTransaction()

  // bail gracefully outside a transaction
  if (!trans) return _gracefail(1)

  var name = trans.getFullName()

  /* If we're in an unnamed transaction, add a friendly warning this is to
   * avoid people going crazy, trying to figure out why browser monitoring is
   * not working when they're missing a transaction name.
   */
  if (!name) return _gracefail(3)

  var time = trans.timer.getDurationInMillis()

  /*
   * Only the first 13 chars of the license should be used for hashing with
   * the transaction name.
   */
  var key = config.license_key.substr(0, 13)
  var appid = config.application_id

  /* This is only going to work if the agent has successfully handshaked with
   * the collector. If the networks is bad, or there is no license key set in
   * newrelis.js, there will be no application_id set.  We bail instead of
   * outputting null/undefined configuration values.
   */
  if (!appid) return _gracefail(4)

  /* If there is no browser_key, the server has likely decided to disable
   * browser monitoring.
   */
  var licenseKey = browser_monitoring.browser_key
  if (!licenseKey) return _gracefail(5)

  /* If there is no agent_loader script, there is no point
   * in setting the rum data
   */
  var js_agent_loader = browser_monitoring.js_agent_loader
  if (!js_agent_loader) return _gracefail(6)

  /* If rum is enabled, but then later disabled on the server,
   * this is the only parameter that gets updated.
   *
   * This condition should only be met if rum is disabled during
   * the lifetime of an application, and it should be picked up
   * on the next ForceRestart by the collector.
   */
  var loader = browser_monitoring.loader
  if (loader === 'none') return _gracefail(7)

  // This hash gets written directly into the browser.
  var rum_hash = {
    agent: browser_monitoring.js_agent_file,
    beacon: browser_monitoring.beacon,
    errorBeacon: browser_monitoring.error_beacon,
    licenseKey: licenseKey,
    applicationID: appid,
    applicationTime: time,
    transactionName: hashes.obfuscateNameUsingKey(name, key),
    queueTime: trans.queueTime,
    ttGuid: trans.id,

    // we don't use these parameters yet
    agentToken: null
  }

  // if debugging, do pretty format of JSON
  var tabs = config.browser_monitoring.debug ? 2 : 0
  var json = JSON.stringify(rum_hash, null, tabs)


  // the complete header to be written to the browser
  var out = util.format(
    RUM_STUB,
    json,
    js_agent_loader
  )

  logger.trace('generating RUM header', out)

  return out
}

/**
 * This creates a new tracer with the passed in name. It then wraps the
 * callback and binds it to the current transaction and segment so any further
 * custom instrumentation as well as auto instrumentation will also be able to
 * find the current transaction and segment.
 */
API.prototype.createTracer = function createTracer(name, callback) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/createTracer'
  )
  metric.incrementCallCount()

  // FLAG: custom_instrumentation
  if (!this.agent.config.feature_flag.custom_instrumentation) {
    return callback
  }

  var fail = false
  if (!name) {
    logger.warn('createTracer called without a name')
    fail = true
  }

  if (typeof callback !== 'function') {
    logger.warn('createTracer called with a callback arg that is not a function')
    fail = true
  }

  if (fail) {
    // If name is undefined but callback is defined we should make a best effort
    // to return it so things don't crash.
    return callback
  }

  var tracer = this.agent.tracer
  var txn = tracer.getTransaction()
  if (!txn) {
    logger.debug(
      'createTracer called with %s (%s) outside of a transaction, ' +
        'unable to create tracer.',
      name,
      callback && callback.name
    )
    return callback
  }

  logger.debug(
    'creating tracer %s (%s) on transaction %s.',
    name,
    callback && callback.name,
    txn.id
  )

  var segment = tracer.createSegment(name, customRecorder)
  segment.start()
  return arity.fixArity(callback, tracer.bindFunction(callback, segment, true))
}

API.prototype.createWebTransaction = util.deprecate(
  createWebTransaction, [
    'API#createWebTransaction is being deprecated!',
    'Please use API#startWebTransaction for transaction creation',
    'and API#getTransaction for transaction management including',
    'ending transactions.'
  ].join(' ')
)

/**
 * Creates a function that represents a web transaction. It does not start the
 * transaction automatically - the returned function needs to be invoked to start it.
 * Inside the handler function, the transaction must be ended by calling endTransaction().
 *
 * @example
 * var newrelic = require('newrelic')
 * var transaction = newrelic.createWebTransaction('/some/url/path', function() {
 *   // do some work
 *   newrelic.endTransaction()
 * })
 *
 * @param {string}    url       The URL of the transaction.  It is used to name and group
                                related transactions in APM, so it should be a generic
                                name and not iclude any variable parameters.
 * @param {Function}  handle    Function that represents the transaction work.
 *
 * @memberOf API#
 *
 * @deprecated since version 2.0
 */
function createWebTransaction(url, handle) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/createWebTransaction'
  )
  metric.incrementCallCount()

  // FLAG: custom_instrumentation
  if (!this.agent.config.feature_flag.custom_instrumentation) {
    return handle
  }

  var fail = false
  if (!url) {
    logger.warn('createWebTransaction called without a url')
    fail = true
  }

  if (typeof handle !== 'function') {
    logger.warn('createWebTransaction called with a handle arg that is not a function')
    fail = true
  }

  if (fail) {
    // If name is undefined but handle is defined we should make a best effort
    // to return it so things don't crash.
    return handle
  }

  logger.debug(
    'creating web transaction generator %s (%s).',
    url,
    handle && handle.name
  )

  var tracer = this.agent.tracer

  var proxy = tracer.transactionNestProxy('web', function createWebSegment() {
    var tx = tracer.getTransaction()

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

    return tracer.bindFunction(handle, tx.baseSegment).apply(this, arguments)
  })
  return arity.fixArity(handle, proxy)
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
 *
 * @param {string} url
 *  The URL of the transaction.  It is used to name and group related transactions in APM,
 *  so it should be a generic name and not iclude any variable parameters.
 *
 * @param {Function}  handle
 *  Function that represents the transaction work.
 */
API.prototype.startWebTransaction = function startWebTransaction(url, handle) {
  var metric = this.agent.metrics.getOrCreateMetric(
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

  logger.debug(
    'starting web transaction %s (%s).',
    url,
    handle && handle.name
  )

  var shim = this.shim
  var tracer = this.agent.tracer

  return tracer.transactionNestProxy('web', function startWebSegment() {
    var tx = tracer.getTransaction()

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

    var boundHandle = tracer.bindFunction(handle, tx.baseSegment)
    var returnResult = boundHandle.call(this)
    if (returnResult && shim.isPromise(returnResult)) {
      returnResult = shim.interceptPromise(returnResult, tx.end.bind(tx))
    } else if (!tx.handledExternally) {
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
 *
 * @param {string} name
 *  The name of the transaction. It is used to name and group related
 *  transactions in APM, so it should be a generic name and not iclude any
 *  variable parameters.
 *
 * @param {string} [group]
 *  Optional, used for grouping background transactions in APM. For more
 *  information see:
 *  https://docs.newrelic.com/docs/apm/applications-menu/monitoring/transactions-page#txn-type-dropdown
 *
 * @param {Function} handle
 *  Function that represents the background work.
 *
 * @memberOf API#
 */
function startBackgroundTransaction(name, group, handle) {
  var metric = this.agent.metrics.getOrCreateMetric(
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

  logger.debug(
    'starting background transaction %s:%s (%s)',
    name,
    group,
    handle && handle.name
  )

  var tracer = this.agent.tracer
  var shim = this.shim
  var txName = group + '/' + name

  return tracer.transactionNestProxy('bg', function startBackgroundSegment() {
    var tx = tracer.getTransaction()

    logger.debug(
      'creating background transaction %s:%s (%s) with transaction id: %s',
      name,
      group,
      handle && handle.name,
      tx.id
    )

    tx.finalizeName(txName)
    tx.baseSegment = tracer.createSegment(name, recordBackground)
    tx.baseSegment.partialName = group
    tx.baseSegment.start()

    var boundHandle = tracer.bindFunction(handle, tx.baseSegment)
    var returnResult = boundHandle.call(this)
    if (returnResult && shim.isPromise(returnResult)) {
      returnResult = shim.interceptPromise(returnResult, tx.end.bind(tx))
    } else if (!tx.handledExternally) {
      tx.end()
    }
    return returnResult
  })()
}

API.prototype.createBackgroundTransaction = util.deprecate(
  createBackgroundTransaction, [
    'API#createBackgroundTransaction is being deprecated!',
    'Please use API#startBackgroundTransaction for transaction creation',
    'and API#getTransaction for transaction management including',
    'ending transactions.'
  ].join(' ')
)

/**
 * Creates a function that represents a background transaction. It does not
 * start the transaction automatically - the returned function needs to be
 * invoked to start it. Inside the handler function, the transaction must be
 * ended by calling `endTransaction()`.
 *
 * @example
 *  var newrelic = require('newrelic')
 *  var startTx = newrelic.createBackgroundTransaction('myTransaction', function(a, b) {
 *    // Do some work
 *    newrelic.endTransaction()
 *  })
 *  startTx('a', 'b') // Start the transaction.
 *
 * @param {string} name
 *  The name of the transaction. It is used to name and group related
 *  transactions in APM, so it should be a generic name and not iclude any
 *  variable parameters.
 *
 * @param {string} [group]
 *  Optional, used for grouping background transactions in APM. For more
 *  information see:
 *  https://docs.newrelic.com/docs/apm/applications-menu/monitoring/transactions-page#txn-type-dropdown
 *
 * @param {Function} handle
 *  Function that represents the background work.
 *
 * @return {Function} The `handle` function wrapped with starting a new
 *  transaction. This function can be called repeatedly to start multiple
 *  transactions.
 *
 * @memberOf API#
 *
 * @deprecated since version 2.0
 */
function createBackgroundTransaction(name, group, handle) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/createBackgroundTransaction'
  )
  metric.incrementCallCount()

  if (handle === undefined && typeof group === 'function') {
    handle = group
    group = 'Nodejs'
  }
  // FLAG: custom_instrumentation
  if (!this.agent.config.feature_flag.custom_instrumentation) {
    return handle
  }

  var fail = false
  if (!name) {
    logger.warn('createBackgroundTransaction called without a name')
    fail = true
  }

  if (typeof handle !== 'function') {
    logger.warn(
      'createBackgroundTransaction called with a handle arg that is not a function'
    )
    fail = true
  }

  if (fail) {
    // If name is undefined but handle is defined we should make a best effort
    // to return it so things don't crash.
    return handle
  }

  logger.debug(
    'creating background transaction generator %s:%s (%s)',
    name,
    group,
    handle && handle.name
  )

  var tracer = this.agent.tracer
  var txName = group + '/' + name

  var proxy = tracer.transactionNestProxy('bg', function createBGSegment() {
    var tx = tracer.getTransaction()

    logger.debug(
      'creating background transaction %s:%s (%s) with transaction id: %s',
      name,
      group,
      handle && handle.name,
      tx.id
    )

    tx.finalizeName(txName)
    tx.baseSegment = tracer.createSegment(name, recordBackground)
    tx.baseSegment.partialName = group
    tx.baseSegment.start()

    return tracer.bindFunction(handle, tx.baseSegment).apply(this, arguments)
  })
  return arity.fixArity(handle, proxy)
}

/**
 * End the current web or background custom transaction. This method requires being in
 * the correct transaction context when called.
 */
API.prototype.endTransaction = function endTransaction() {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/endTransaction'
  )
  metric.incrementCallCount()

  // FLAG: custom_instrumentation
  if (!this.agent.config.feature_flag.custom_instrumentation) {
    return
  }

  var tracer = this.agent.tracer
  var tx = tracer.getTransaction()

  if (tx) {
    if (tx.baseSegment) {
      if (tx.type === 'web') {
        tx.finalizeNameFromUri(tx.url, 0)
      }
      tx.baseSegment.end()
    }
    logger.debug('ending transaction with id: %s and name: %s', tx.id, tx.name)
    tx.end()
  } else {
    logger.debug('endTransaction() called while not in a transaction.')
  }
}

/**
 * Record an event-based metric, usually associated with a particular duration.
 * The `name` must be a string following standard metric naming rules. The `value` will
 * usually be a number, but it can also be an object.
 *   * When `value` is a numeric value, it should represent the magnitude of a measurement
 *     associated with an event; for example, the duration for a particular method call.
 *   * When `value` is an object, it must contain count, total, min, max, and sumOfSquares
 *     keys, all with number values. This form is useful to aggregate metrics on your own
 *     and report them periodically; for example, from a setInterval. These values will
 *     be aggregated with any previously collected values for the same metric. The names
 *     of these keys match the names of the keys used by the platform API.
 *
 * @param  {string} name  The name of the metric.
 * @param  {number|object} value
 */
API.prototype.recordMetric = function recordMetric(name, value) {
  var supportMetric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/recordMetric'
  )
  supportMetric.incrementCallCount()

  // FLAG: custom_metrics
  if (!this.agent.config.feature_flag.custom_metrics) {
    return
  }

  if (typeof name !== 'string') {
    logger.warn('Metric name must be a string')
    return
  }

  var metric = this.agent.metrics.getOrCreateMetric(name)

  if (typeof value === 'number') {
    metric.recordValue(value)
    return
  }

  if (typeof value !== 'object') {
    logger.warn('Metric value must be either a number, or a metric object')
    return
  }

  var stats = {}
  var required = ['count', 'total', 'min', 'max', 'sumOfSquares']
  var keyMap = {count: 'callCount'}

  for (var i = 0, l = required.length; i < l; ++i) {
    if (typeof value[required[i]] !== 'number') {
      logger.warn('Metric object must include %s as a number', required[i])
      return
    }

    var key = keyMap[required[i]] || required[i]
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
 * Update a metric that acts as a simple counter. The count of the selected metric will
 * be incremented by the specified amount, defaulting to 1.
 *
 * @param  {string} name  The name of the metric.
 * @param  {number} [value] The amount that the count of the metric should be incremented
 *                          by.
 */
API.prototype.incrementMetric = function incrementMetric(name, value) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/incrementMetric'
  )
  metric.incrementCallCount()

  // FLAG: custom_metrics
  if (!this.agent.config.feature_flag.custom_metrics) {
    return
  }

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
 * Record an event-based metric, usually associated with a particular duration.
 *
 * @param  {string} eventType  The name of the event. It must be an alphanumeric string
 *                             less than 255 characters.
 * @param  {object} attributes Object of key and value pairs. The keys must be shorter
 *                             than 255 characters, and the values must be string, number,
 *                             or boolean.
 */
API.prototype.recordCustomEvent = function recordCustomEvent(eventType, attributes) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/recordCustomEvent'
  )
  metric.incrementCallCount()

  // If high security mode is on, custom events are disabled.
  if (this.agent.config.high_security === true) {
    logger.warnOnce(
      "Custom Event",
      "Custom events are disabled by high security mode."
    )
    return false
  } else if (!this.agent.config.api.custom_events_enabled) {
    logger.debug(
      "Config.api.custom_events_enabled set to false, not collecting value"
    )
    return false
  }

  if (!this.agent.config.custom_insights_events.enabled) {
    return
  }
  // Check all the arguments before bailing to give maximum information in a
  // single invocation.
  var fail = false

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
  // an object, or if it is an object and but is actually an array, log a
  // warning and set the fail bit.
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
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

  var instrinics = {
    type: eventType,
    timestamp: Date.now()
  }

  this.agent.customEvents.add([instrinics, attributes])
}

/**
 * Registers an instrumentation function.
 *
 *  - `newrelic.instrument(moduleName, onRequire [,onError])`
 *  - `newrelic.instrument(options)`
 *
 * @param {object} options
 *  The options for this custom instrumentation.
 *
 * @param {string} options.moduleName
 *  The module name given to require to load the module
 *
 * @param {function}  options.onRequire
 *  The function to call when the module is required
 *
 * @param {function} [options.onError]
 *  If provided, should `onRequire` throw an error, the error will be passed to
 *  this function.
 */
API.prototype.instrument = function instrument(moduleName, onRequire, onError) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/instrument'
  )
  metric.incrementCallCount()

  var opts = moduleName
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
 *  - `newrelic.instrumentDatastore(moduleName, onRequire [,onError])`
 *  - `newrelic.instrumentDatastore(options)`
 *
 * @param {object} options
 *  The options for this custom instrumentation.
 *
 * @param {string} options.moduleName
 *  The module name given to require to load the module
 *
 * @param {function}  options.onRequire
 *  The function to call when the module is required
 *
 * @param {function} [options.onError]
 *  If provided, should `onRequire` throw an error, the error will be passed to
 *  this function.
 */
API.prototype.instrumentDatastore =
function instrumentDatastore(moduleName, onRequire, onError) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/instrumentDatastore'
  )
  metric.incrementCallCount()

  var opts = moduleName
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
 * @param {object} options
 *  The options for this custom instrumentation.
 *
 * @param {string} options.moduleName
 *  The module name given to require to load the module
 *
 * @param {function}  options.onRequire
 *  The function to call when the module is required
 *
 * @param {function} [options.onError]
 *  If provided, should `onRequire` throw an error, the error will be passed to
 *  this function.
 */
API.prototype.instrumentWebframework =
function instrumentWebframework(moduleName, onRequire, onError) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/instrumentWebframework'
  )
  metric.incrementCallCount()

  var opts = moduleName
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
 * @param {object} options
 *  The options for this custom instrumentation.
 *
 * @param {string} options.moduleName
 *  The module name given to require to load the module
 *
 * @param {function}  options.onRequire
 *  The function to call when the module is required
 *
 * @param {function} [options.onError]
 *  If provided, should `onRequire` throw an error, the error will be passed to
 *  this function.
 */
API.prototype.instrumentMessages =
function instrumentMessages(moduleName, onRequire, onError) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/instrumentMessages'
  )
  metric.incrementCallCount()

  var opts = moduleName
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
 * Shuts down the agent.
 *
 * @param {object}  [options]                           object with shut down options
 * @param {boolean} [options.collectPendingData=false]  If true, the agent will send any
 *                                                      pending data to the collector
 *                                                      before shutting down.
 * @param {number}  [options.timeout]                   time in ms to wait before
 *                                                      shutting down
 * @param {function} [callback]                         callback function that runs when
 *                                                      agent stopped
 */
API.prototype.shutdown = function shutdown(options, cb) {
  var metric = this.agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.API + '/shutdown'
  )
  metric.incrementCallCount()

  var callback = cb
  if (!callback) {
    if (typeof options === 'function') {
      callback = options
    } else {
      callback = function noop() {}
    }
  }

  var agent = this.agent

  function cb_harvest(error) {
    if (error) {
      logger.error(
        error,
        'An error occurred while running last harvest before shutdown.'
      )
    }
    agent.stop(callback)
  }

  if (options && options.collectPendingData && agent._state !== 'started') {
    if (typeof options.timeout === 'number') {
      var shutdownTimeout = setTimeout(function shutdownTimeout() {
        agent.stop(callback)
      }, options.timeout)
      // timer.unref only in 0.9+
      if (shutdownTimeout.unref) {
        shutdownTimeout.unref()
      }
    } else if (options.timeout) {
      logger.warn(
        'options.timeout should be of type "number". Got %s',
        typeof options.timeout
      )
    }

    agent.on('started', function shutdownHarvest() {
      agent.harvest(cb_harvest)
    })
    agent.on('errored', function logShutdownError(error) {
      agent.stop(callback)
      if (error) {
        logger.error(
          error,
          'The agent encountered an error after calling shutdown.'
        )
      }
    })
  } else if (options && options.collectPendingData) {
    agent.harvest(cb_harvest)
  } else {
    agent.stop(callback)
  }
}

function _checkKeyLength(object, maxLength) {
  var keys = Object.keys(object)
  var badKey = false
  var len = keys.length
  var key = '' // init to string because gotta go fast
  for (var i = 0; i < len; i++) {
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

module.exports = API
