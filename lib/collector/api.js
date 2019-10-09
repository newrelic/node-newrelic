'use strict'

const CollectorResponse = require('./response')
const facts = require('./facts')
const logger = require('../logger').child({component: 'collector_api'})
const RemoteMethod = require('./remote-method')

const NAMES = require('../metrics/names')

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

// Expected collector response codes
const SUCCESS = new Set([200, 202])
const RESTART = new Set([401, 409])
const FAILURE_SAVE_DATA = new Set([408, 429, 500, 503])
const FAILURE_DISCARD_DATA = new Set(
  [400, 403, 404, 405, 407, 411, 413, 414, 415, 417, 431]
)

const AGENT_RUN_BEHAVIOR = CollectorResponse.AGENT_RUN_BEHAVIOR

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

  logger.trace('Starting collector.')

  this._agent.setState('connecting')

  const api = this
  const max = BACKOFFS.length
  const errors = []
  let attempts = 1

  const metric = this._agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.REGISTRATION + '/Attempts'
  )

  // Reset headers map for good measure
  if (this._reqHeadersMap) {
    this._reqHeadersMap = null
  }

  function retry(error, response) {
    metric.incrementCallCount()

    if (error) {
      errors.push(error)
    } else if (response && SUCCESS.has(response.status)) {
      dumpErrors(errors, 'connect')
      return callback(null, CollectorResponse.success(response.payload))
    }
    if (!response) {
      response = CollectorResponse.retry()
    }

    // Retry everything except for an explicit Disconnect response code.
    if (response.status === 410 || response.agentRun === AGENT_RUN_BEHAVIOR.SHUTDOWN) {
      logger.error('The New Relic collector rejected this agent.')
      return callback(null, CollectorResponse.fatal(response.payload))
    } else if (response.status === 401) {
      logger.warn(
        error,
        'Your license key appears to be invalid. Reattempting connection to New' +
        ' Relic. If the problem persists, please contact support@newrelic.com.' +
        ' (status code %s)',
        response.status
      )
    }

    let backoff = BACKOFFS[Math.min(attempts, max) - 1]
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
    const timeout = setTimeout(function again() {
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

  const preconnectData = { high_security: agent.config.high_security }
  if (agent.config.security_policies_token) {
    preconnectData.security_policies_token = agent.config.security_policies_token
  }

  const payload = [preconnectData]

  methods.redirect.invoke(payload, onPreConnect)

  function onPreConnect(error, response) {
    if (error || !SUCCESS.has(response.status)) {
      return callback(error, response)
    }

    const res = response.payload || Object.create(null)
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

    const laspResponse = agent.config.applyLasp(agent, policies)
    if (laspResponse.shouldShutdownRun()) {
      return callback(null, laspResponse)
    }

    self._getFacts(laspResponse.payload, callback)
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

  function onConnect(error, res) {
    if (error || !SUCCESS.has(res.status)) {
      return callback(error, res)
    }

    const config = res.payload
    if (!config || !config.agent_run_id) {
      return callback(new Error('No agent run ID received from handshake.'), res)
    }

    agent.setState('connected')
    logger.info(
      'Connected to %s:%d with agent run ID %s.',
      agent.config.host,
      agent.config.port,
      config.agent_run_id
    )

    // Log "Reporting to..." message from connect response.
    if (config.messages) {
      config.messages.forEach((element) => {
        logger.info(element.message)
      })
    }

    // Store request headers for future collector requests if they're present
    collector._reqHeadersMap = config.request_headers_map

    // pass configuration data from the API so automatic reconnect works
    agent.reconfigure(config)

    callback(null, res)
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
    function onReportSettings(error, response) {
      if (error) dumpErrors([error], 'agent_settings')

      if (callback) callback(error, response)
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
CollectorAPI.prototype.error_data = function errorData(errors, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!errors) {
    return callback(new TypeError('must pass errors to send'))
  }

  this._sendData(this._methods.errors, errors, callback)
}

CollectorAPI.prototype.error_event_data = function errorEvents(events, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!events) {
    return callback(new TypeError('must pass errors to send'))
  }

  this._sendData(this._methods.errorEvents, events, callback)
}

CollectorAPI.prototype.analytic_event_data = transactionEvents
function transactionEvents(events, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!events) {
    return callback(new TypeError('must pass events to send'))
  }

  this._sendData(this._methods.events, events, callback)
}

CollectorAPI.prototype.custom_event_data = function customEvents(events, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!events) {
    return callback(new TypeError('must pass events to send'))
  }

  this._sendData(this._methods.customEvents, events, callback)
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
CollectorAPI.prototype.metric_data = function metricData(metrics, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!metrics) {
    return callback(new TypeError('must pass metrics to send'))
  }

  this._sendData(this._methods.metrics, metrics, callback)
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
CollectorAPI.prototype.sql_trace_data = function queryData(queries, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!queries) {
    return callback(new TypeError('must pass queries to send'))
  }
  this._sendData(this._methods.queryData, queries, callback)
}

CollectorAPI.prototype.span_event_data = function spanEvents(events, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!events) {
    return callback(new TypeError('must pass spans to send'))
  }
  this._sendData(this._methods.spanEvents, events, callback)
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
CollectorAPI.prototype.transaction_sample_data = transactionSampleData
function transactionSampleData(traces, callback) {
  if (!callback) {
    throw new TypeError('callback is required')
  }
  if (!traces) {
    return callback(new TypeError('must pass traces to send'))
  }

  this._sendData(this._methods.traces, traces, callback)
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

  logger.info('Shutting down collector.')

  var agent = this._agent
  this._methods.shutdown.invoke(null, this._reqHeadersMap, onShutdown)

  function onShutdown(error, response) {
    if (error) {
      dumpErrors([error], 'shutdown')
    }

    agent.setState('disconnected')
    logger.info(
      'Disconnected from New Relic; clearing run ID %s.',
      agent.config.run_id
    )
    agent.config.run_id = undefined

    callback(error, CollectorResponse.fatal(response && response.payload))
  }
}

CollectorAPI.prototype.restart = function restart(callback) {
  logger.info('Restarting collector.')

  this._agent.stopAggregators()
  var api = this
  this.shutdown(function reconnect() {
    api.connect(function afterConnect() {
      api._agent.onConnect()
      api._agent.startAggregators()
      return callback.apply(null, arguments)
    })
  })
}

CollectorAPI.prototype._runLifecycle = function _runLifecycle(method, body, callback) {
  if (!this.isConnected()) {
    logger.warn('Not connected to New Relic. Not calling.', method.name)
    const error = new Error('Not connected to collector.', null, null)
    return setImmediate(callback, error)
  }

  const api = this
  method.invoke(body, this._reqHeadersMap, function standardHandler(error, response) {
    if (error) {
      return callback(error)
    }

    return api._handleResponseCode(response, method.name, callback)
  })
}

CollectorAPI.prototype._sendData = function _sendData(method, data, callback) {
  this._runLifecycle(method, data, (error, response) => {
    // Any runtime errors should preserve the agent run.
    if (error) {
      // TODO: log error
      // TODO: differentiate between network (retain) and non-network (drop).

      callback(error, { retainData: true })

      return
    }

    if (!response) {
      callback()

      return
    }

    // TODO: log the payload if exists?

    if (response.agentRun === AGENT_RUN_BEHAVIOR.SHUTDOWN) {
      // TODO: for now, shut handled in _handleResponseCode for consistency
      // either find way to safely change while side-by-side or move
      // once side-by-side gone. Currently, stop is called twice on teh old code path

      // TODO: almost seems better to let aggregator finish (cb) then shutdown?

      // this._agent.stop((err) => {
      //   // TODO: agent stop requires a callback. if we don't care to do anythig here
      //   // do we loosen that requirement or perhaps have a different "shutdown"
      //   // method? Does seem like you'd want to log a shutdown error
      //   // but don't really care about that *here*
      // })

      callback(null, {retainData: response.retainData})
    } else if (response.agentRun === AGENT_RUN_BEHAVIOR.RESTART) {
      // TODO: almost seems better to leg aggregator finish (cb) then restart?

      // TODO: ensure harvesting stopped for all other endpoints. same for shutdown.

      this.restart(function afterRestart(connectError) {
        if (connectError) {
          // TODO: What if preconnect/connect respond with shutdown here?

          // TODO: maybe indicate which endpoint triggered
          // other behaviors on failure?
          logger.warn('Failed to restart agent run.')
        } else {
          logger.trace('Restart succeeded.')
        }

        callback(null, {retainData: response.retainData})
        // TODO: keep object or enum of actions? retain / split / other?
      })
    } else {
      callback(null, {
        retainData: response.retainData
      })
    }
  })
}


CollectorAPI.prototype.isConnected = function isConnected() {
  return !!this._agent.config.run_id
}

/**
 * Returns appropriate CollectorResponse object according to response code.
 *
 * @param {object} response
 * @param {number} response.status  - Status code from collector response
 * @param {object} response.payload - Parsed response body, if any
 * @param {string} endpoint         - Collector endpoint name
 * @param {Function} cb             - CollectorAPI method invocation callback
 */
CollectorAPI.prototype._handleResponseCode = _handleResponseCode
function _handleResponseCode(response, endpoint, cb) {
  const code = response.status

  /* eslint-disable padded-blocks */
  if (SUCCESS.has(code)) {
    // The request was a success!
    return setImmediate(cb, null, CollectorResponse.success(response.payload))
  } else if (RESTART.has(code)) {
    // The agent needs to disconnect and restart.
    logFailure(endpoint, code, 'Restarting')
    return setImmediate(cb, null, CollectorResponse.reconnect(0, null))

  } else if (FAILURE_DISCARD_DATA.has(code)) {
    // Something was wrong with our payload so we must delete our data.
    logFailure(endpoint, code, 'Discarding harvest data')
    return setImmediate(cb, null, CollectorResponse.discard(null))

  } else if (FAILURE_SAVE_DATA.has(code)) {
    // Something was wrong with the request, but it wasn't our fault. We'll try again.
    logFailure(endpoint, code, 'Retaining data for next harvest')
    return setImmediate(cb, null, CollectorResponse.error(response.payload))

  } else if (code === 410) {
    // New Relic doesn't like us and we shouldn't try to talk to them any more.
    logFailure(endpoint, code, 'Disconnecting from New Relic')

    return this._agent.stop(function onShutdown() {
      cb(null, CollectorResponse.fatal(response.payload))
    })
  }
  /* eslint-enable padded-blocks */

  // We're not sure what New Relic is trying to tell us. Let's get rid of our
  // data just in case it is our fault.
  logger.error(
    'Agent endpoint %s returned unexpected status %s.',
    endpoint,
    code
  )
  return setImmediate(cb, null, CollectorResponse.discard(null))
}

function logFailure(endpoint, code, action) {
  logger.error('Agent endpoint %s returned %s status. %s.', endpoint, code, action)
}

module.exports = CollectorAPI
