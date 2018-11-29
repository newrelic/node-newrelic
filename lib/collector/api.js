'use strict'

const CollectorResponse = require('./response')
const facts = require('./facts')
const logger = require('../logger').child({component: 'collector_api'})
const RemoteMethod = require('./remote-method')
const handleErrorCode = require('./response-codes')

// just to make clear what's going on
const TO_MILLIS = 1e3

// taken directly from Python agent's newrelic.core.application
const BACKOFFS = [
  {interval: 15, warn: false},
  {interval: 15, warn: false},
  {interval: 30, warn: false},
  {interval: 60, warn: true},
  {interval: 120, warn: false},
  {interval: 300, warn: false}
]

function dumpErrors(errors, name) {
  var index = 1

  errors.forEach(function forEachError(error) {
    logger.trace(error, 'Error %s during %s:', index++, name)

    if (error.laterErrors) {
      error.laterErrors.forEach(function forEachLaterError(laterError) {
        logger.trace(laterError, 'Error %s during %s:', index++, name)
      })
    }
  })
}


function CollectorAPI(agent) {
  this._agent = agent
  this._reqHeadersMap = null

  /* RemoteMethods can be reused and have little per-object state, so why not
   * save some GC time?
   */
  this._methods = {
    redirect: new RemoteMethod('preconnect', agent.config),
    handshake: new RemoteMethod('connect', agent.config),
    settings: new RemoteMethod('agent_settings', agent.config),
    errors: new RemoteMethod('error_data', agent.config),
    metrics: new RemoteMethod('metric_data', agent.config),
    traces: new RemoteMethod('transaction_sample_data', agent.config),
    shutdown: new RemoteMethod('shutdown', agent.config),
    events: new RemoteMethod('analytic_event_data', agent.config),
    customEvents: new RemoteMethod('custom_event_data', agent.config),
    queryData: new RemoteMethod('sql_trace_data', agent.config),
    errorEvents: new RemoteMethod('error_event_data', agent.config),
    spanEvents: new RemoteMethod('span_event_data', agent.config)
  }
}

CollectorAPI.prototype.connect = function connect(callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }

  var api = this
  var attempts = 1
  var max = BACKOFFS.length
  var errors = []

  // Reset headers map for good measure
  if (this._reqHeadersMap) {
    this._reqHeadersMap = null
  }

  function retry(error, response, body) {
    if (!error) {
      dumpErrors(errors, 'connect')
      return callback(error, response, body)
    }

    errors.push(error)

    // Retry everything except for an explicit Disconnect response code.
    if (error.statusCode === 410) {
      logger.error('The New Relic collector rejected this agent.')
      logger.error(error.message)
      return callback(error, response, body)
    } else if (error.statusCode === 401) {
      logger.warn(
        error,
        'Your license key appears to be invalid. Reattempting connection to New' +
        ' Relic. If the problem persists, please contact support@newrelic.com.'
      )
    }

    var backoff = BACKOFFS[Math.min(attempts, max) - 1]
    if (backoff.warn) {
      logger.warn(
        'No connection has been established to New Relic after %d attempts.',
        attempts
      )
    }

    logger.debug(
      error,
      'Failed to connect to New Relic after attempt %d, waiting %ds to retry.',
      attempts,
      backoff.interval
    )

    ++attempts
    var timeout = setTimeout(function again() {
      api._login(retry)
    }, backoff.interval * TO_MILLIS)
    timeout.unref()
  }

  this._login(retry)
}

CollectorAPI.prototype._login = function _login(callback) {
  var methods = this._methods
  var agent = this._agent
  var self = this

  var payload = agent.config.security_policies_token
    ? [{ security_policies_token: agent.config.security_policies_token }]
    : null

  methods.redirect.invoke(payload, onPreConnect)

  function onPreConnect(error, res, body) {
    if (error) {
      return callback(error, res, body)
    }

    res = res || Object.create(null)
    if (!res.redirect_host) {
      logger.error(
        "Requesting this account's collector from %s failed; trying default.",
        agent.config.host
      )
    } else {
      var parts = res.redirect_host.split(':')
      if (parts.length > 2) {
        logger.error(
          "Requesting collector from %s returned bogus result '%s'; trying default.",
          agent.config.host,
          res.redirect_host
        )
      } else {
        logger.debug(
          "Requesting this account's collector from %s returned %s; reconfiguring.",
          agent.config.host,
          res.redirect_host
        )

        agent.config.host = parts[0]
        agent.config.port = parts[1] || 443
      }
    }

    var policies = res.security_policies || Object.create(null)

    agent.config.applyLasp(agent, policies, function onApply(err, lasp, laspBody) {
      if (err) {
        return callback(err, lasp, laspBody)
      }
      self._getFacts(lasp, callback)
    })
  }
}

CollectorAPI.prototype._getFacts = function _getFacts(lasp, callback) {
  var agent = this._agent
  var self = this

  facts(agent, function getEnvDict(environmentDict) {
    if (lasp) {
      environmentDict.security_policies = lasp
    }

    // The collector really likes arrays.
    // In fact, it kind of insists on them.
    var environment = [environmentDict]

    self._connect(environment, callback)
  })
}

CollectorAPI.prototype._connect = function _connect(env, callback) {
  const collector = this
  const methods = this._methods
  const agent = this._agent

  methods.handshake.invoke(env, onConnect)

  function onConnect(error, config, body) {
    if (error) return callback(error, config, body)
    if (!config || !config.agent_run_id) {
      return callback(new Error('No agent run ID received from handshake.'), config)
    }

    agent.setState('connected')
    logger.info(
      'Connected to %s:%d with agent run ID %s.',
      agent.config.host,
      agent.config.port,
      config.agent_run_id
    )

    // Store request headers for future collector requests if they're present
    collector._reqHeadersMap = config.request_headers_map

    // pass configuration data from the API so automatic reconnect works
    agent.reconfigure(config)

    callback(null, config, body)
  }
}

/**
 * Send current public agent settings to collector. This should always be
 * invoked after a successful connect response with server-side settings, but
 * will also be invoked on any other config changes.
 *
 * @param {Function} callback The continuation / error handler.
 */
CollectorAPI.prototype.reportSettings = function reportSettings(callback) {
  // The second argument to the callback is always empty data
  this._methods.settings.invoke(
    [this._agent.config.publicSettings()],
    this._reqHeadersMap,
    function onReportSettings(error, unused, body) {
      if (error) dumpErrors([error], 'agent_settings')

      if (callback) callback(error, body)
    }
  )
}

/**
 * Send already-formatted error data by calling error_data. For
 * performance reasons, the API methods do no validation, but the
 * collector expects data in an exact format. It expects a JSON array
 * containing the following 2 elements:
 *
 * 1. The agent run ID.
 * 2. An array of one or more errors. See lib/error.js for details.
 *
 * @param {Array}    errors   The encoded errors list.
 * @param {Function} callback The continuation / error handler.
 */
CollectorAPI.prototype.errorData = function errorData(errors, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!errors) {
    return callback(new TypeError('must pass errors to send'))
  }
  this._runLifecycle(this._methods.errors, errors, callback)
}

/**
 * Send already-formatted metric data by calling metric_data. For
 * performance reasons, the API methods do no validation, but the collector
 * expects data in an exact format format. It expects a JSON array containing
 * the following 4 elements:
 *
 * 1. The agent run ID.
 * 2. The time the metric data started being collected, in seconds since the
 *    epoch.
 * 3. The time the metric data finished being collected, in seconds since the
 *    epoch.
 * 4. An array of 1 or more metric arrays. See lib/metrics.js for details.
 *
 * @param {Array}    metrics  The encoded metrics list.
 * @param {Function} callback The continuation / error handler.
 */
CollectorAPI.prototype.metricData = function metricData(metrics, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!metrics) {
    return callback(new TypeError('must pass metrics to send'))
  }
  this._runLifecycle(this._methods.metrics, metrics, callback)
}

CollectorAPI.prototype.analyticsEvents = function analyticsEvents(events, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!events) {
    return callback(new TypeError('must pass events to send'))
  }
  this._runLifecycle(this._methods.events, events, callback)
}

CollectorAPI.prototype.customEvents = function customEvents(events, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!events) {
    return callback(new TypeError('must pass events to send'))
  }
  this._runLifecycle(this._methods.customEvents, events, callback)
}

/**
 * Send already-formatted slow SQL data by calling
 * sql_trace_data. For performance reasons, the API methods
 * do no validation, but the collector expects data in an exact format
 * format. It expects a JSON array containing the following 2 elements:
 *
 * 1. The agent run ID.
 * 2. The encoded slow SQL data.
 *
 * @param {Array}    queries  The encoded slow SQL data.
 * @param {Function} callback The continuation / error handler.
 */
CollectorAPI.prototype.queryData = function queryData(queries, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!queries) {
    return callback(new TypeError('must pass queries to send'))
  }
  this._runLifecycle(this._methods.queryData, queries, callback)
}

CollectorAPI.prototype.errorEvents = function errorEvents(events, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!events) {
    return callback(new TypeError('must pass errors to send'))
  }
  this._runLifecycle(this._methods.errorEvents, events, callback)
}

CollectorAPI.prototype.spanEvents = function spanEvents(events, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!events) {
    return callback(new TypeError('must pass spans to send'))
  }
  this._runLifecycle(this._methods.spanEvents, events, callback)
}

/**
 * Send already-formatted slow trace data by calling
 * transaction_sample_data. For performance reasons, the API methods
 * do no validation, but the collector expects data in an exact format
 * format. It expects a JSON array containing the following 2 elements:
 *
 * 1. The agent run ID.
 * 2. The encoded slow trace data. This is the most complicated data
 *    format handled by the module, and documenting it is almost beyond the
 *    scope of comments. See lib/transaction/trace.js for details.
 *
 * @param {Array}    trace    The encoded trace data.
 * @param {Function} callback The continuation / error handler.
 */
CollectorAPI.prototype.transactionSampleData = transactionSampleData
function transactionSampleData(trace, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!trace) {
    return callback(new TypeError('must pass slow trace data to send'))
  }
  this._runLifecycle(this._methods.traces, trace, callback)
}

/**
 * Sends no data aside from the message itself. Clears the run ID, which
 * effectively disconnects the agent from the collector.
 *
 * @param Function callback Runs after the run ID has been cleared.
 */
CollectorAPI.prototype.shutdown = function shutdown(callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }

  var agent = this._agent
  this._methods.shutdown.invoke(null, this._reqHeadersMap, onShutdown)

  function onShutdown(error, returned) {
    if (error) {
      dumpErrors([error], 'shutdown')
    } else {
      agent.setState('disconnected')
      logger.info(
        "Disconnected from New Relic; clearing run ID %s.",
        agent.config.run_id
      )
      agent.config.run_id = undefined
    }
    callback(error, CollectorResponse.fatal(returned))
  }
}

CollectorAPI.prototype._restart = function _restart(callback) {
  var api = this
  this.shutdown(function reconnect() {
    api.connect(callback)
  })
}

CollectorAPI.prototype._runLifecycle = function _runLifecycle(method, body, callback) {
  if (!this.isConnected()) {
    logger.warn('Not connected to New Relic. Not calling.', method.name)
    return callback(new Error('Not connected to collector.', null, null))
  }

  const api = this
  function standardHandler(error, returned) {
    if (!error) {
      return callback(null, CollectorResponse.success(returned))
    }

    // TODO: Refactor this so that the Harvest class always gets the error and can
    // perform its own handling for 413s.
    dumpErrors([error], method.name)

    return handleErrorCode(error, returned, method.name, callback, api)
  }

  method.invoke(body, this._reqHeadersMap, standardHandler)
}

CollectorAPI.prototype.isConnected = function isConnected() {
  return !!this._agent.config.run_id
}

module.exports = CollectorAPI
