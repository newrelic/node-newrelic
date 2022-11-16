/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const http = require('http')
const CollectorResponse = require('./response')
const facts = require('./facts')
const logger = require('../logger').child({ component: 'collector_api' })
const RemoteMethod = require('./remote-method')

const NAMES = require('../metrics/names')

const DEFAULT_PORT = 443

// just to make clear what's going on
const TO_MILLIS = 1e3

// taken directly from Python agent's newrelic.core.application
const BACKOFFS = [
  { interval: 15, warn: false },
  { interval: 15, warn: false },
  { interval: 30, warn: false },
  { interval: 60, warn: true },
  { interval: 120, warn: false },
  { interval: 300, warn: false }
]

// Expected collector response codes
const SUCCESS = new Set([200, 202])
const RESTART = new Set([401, 409])
const FAILURE_SAVE_DATA = new Set([408, 429, 500, 503])
const FAILURE_DISCARD_DATA = new Set([400, 403, 404, 405, 407, 411, 413, 414, 415, 417, 431])

const AGENT_RUN_BEHAVIOR = CollectorResponse.AGENT_RUN_BEHAVIOR

/**
 * @param {Array} errors list of errors
 * @param {string} name collector endpoint name
 */
function dumpErrors(errors, name) {
  let index = 1

  errors.forEach(function forEachError(error) {
    logger.trace(error, 'Error %s during %s:', index++, name)

    if (error.laterErrors) {
      error.laterErrors.forEach(function forEachLaterError(laterError) {
        logger.trace(laterError, 'Error %s during %s:', index++, name)
      })
    }
  })
}

/**
 * @param {Agent} agent New Relic agent
 */
function CollectorAPI(agent) {
  this._agent = agent
  this._reqHeadersMap = null

  const initialEndpoint = {
    host: agent.config.host,
    port: agent.config.port
  }

  /* RemoteMethods can be reused and have little per-object state, so why not
   * save some GC time?
   */
  this._methods = {}
  for (const [accessor, name] of [
    ['preconnect', 'preconnect'],
    ['connect', 'connect'],
    ['settings', 'agent_settings'],
    ['errors', 'error_data'],
    ['metrics', 'metric_data'],
    ['traces', 'transaction_sample_data'],
    ['shutdown', 'shutdown'],
    ['events', 'analytic_event_data'],
    ['customEvents', 'custom_event_data'],
    ['queryData', 'sql_trace_data'],
    ['errorEvents', 'error_event_data'],
    ['spanEvents', 'span_event_data'],
    ['logEvents', 'log_event_data']
  ]) {
    const method = new RemoteMethod(name, agent, initialEndpoint)
    this._methods[accessor] = method
  }
}

CollectorAPI.prototype._throwCallbackError = function _throwCallbackError() {
  throw new TypeError('callback is required')
}

/**
 * Updates all methods except preconnect w/ new host/port pairs sent down from server
 * during preconnect (via redirect_host). Preconnect does not update.
 *
 * @param {string} endpoint collector name
 */
CollectorAPI.prototype._updateEndpoints = function _updateEndpoints(endpoint) {
  logger.trace('Updating endpoints to: ', endpoint)
  for (const [key, remoteMethod] of Object.entries(this._methods)) {
    // Preconnect should always use configured options, not updates from server.
    if (key !== 'preconnect') {
      remoteMethod.updateEndpoint(endpoint)
    }
  }
}

CollectorAPI.prototype.connect = function connect(callback) {
  if (!callback) {
    this._throwCallbackError()
  }

  logger.trace('Starting collector.')

  this._agent.setState('connecting')

  // Reset headers map for good measure
  if (this._reqHeadersMap) {
    this._reqHeadersMap = null
  }

  const ctx = {
    callback,
    max: BACKOFFS.length,
    errors: [],
    attempts: 1
  }
  this._login(this._retry.bind(this, ctx))
}

/**
 * Checks if proxy is configured to connect via `proxy_host` and `proxy_port`
 * and if error code is EPROTO or ECONNRESET. This is an indication their proxy
 * server only accepts HTTP connections, and we should provide an actionable warning to
 * fix the misconfiguration by setting `proxy` to a fully qualified URL
 *
 * @param {Error} error response error
 * @returns {boolean} determines if proxy is properly configured
 */
CollectorAPI.prototype._isProxyMisconfigured = function _isProxyMisconfigured(error) {
  const config = this._agent.config
  return (
    error &&
    ['EPROTO', 'ECONNRESET'].includes(error.code) &&
    config.proxy_host &&
    config.proxy_port &&
    !config.proxy
  )
}

/**
 * @param {object} ctx context object to pass from parent and between recursions.
 * @param {Error} error response error
 * @param {http.ServerResponse} response response from collector
 * @returns {void}
 */
CollectorAPI.prototype._retry = function _retry(ctx, error, response) {
  const api = this
  const metric = this._agent.metrics.getOrCreateMetric(
    NAMES.SUPPORTABILITY.REGISTRATION + '/Attempts'
  )

  metric.incrementCallCount()

  if (error) {
    ctx.errors.push(error)
  } else if (response && SUCCESS.has(response.status)) {
    dumpErrors(ctx.errors, 'connect')
    ctx.callback(null, CollectorResponse.success(response.payload))
    return
  }
  if (!response) {
    response = CollectorResponse.retry()
  }

  // Retry everything except for an explicit Disconnect response code.
  if (response.status === 410 || response.agentRun === AGENT_RUN_BEHAVIOR.SHUTDOWN) {
    logger.error('The New Relic collector rejected this agent.')
    return ctx.callback(null, CollectorResponse.fatal(response.payload))
  } else if (response.status === 401) {
    logger.warn(
      error,
      'Your license key appears to be invalid. Reattempting connection to New' +
        ' Relic. If the problem persists, please contact support@newrelic.com.' +
        ' (status code %s)',
      response.status
    )
  } else if (this._isProxyMisconfigured(error)) {
    logger.warn(
      error,
      'Your proxy server appears to be configured to accept connections over http. ' +
        'When setting `proxy_host` and `proxy_port` New Relic attempts to connect over ' +
        'SSL(https). If your proxy is configured to accept connections over http, try ' +
        'setting `proxy` to a fully qualified URL(e.g http://proxy-host:8080).'
    )
  }

  const backoff = BACKOFFS[Math.min(ctx.attempts, ctx.max) - 1]
  if (backoff.warn) {
    logger.warn('No connection has been established to New Relic after %d attempts.', ctx.attempts)
  }

  logger.debug(
    error,
    'Failed to connect to New Relic after attempt %d, waiting %ds to retry.',
    ctx.attempts,
    backoff.interval
  )

  ++ctx.attempts
  const timeout = setTimeout(function again() {
    api._login(api._retry.bind(api, ctx))
  }, backoff.interval * TO_MILLIS)
  timeout.unref()
}

CollectorAPI.prototype._login = function _login(callback) {
  const methods = this._methods
  const agent = this._agent

  const preconnectData = { high_security: agent.config.high_security }
  if (agent.config.security_policies_token) {
    preconnectData.security_policies_token = agent.config.security_policies_token
  }

  const payload = [preconnectData]

  methods.preconnect.invoke(payload, this._onPreConnect.bind(this, callback))
}

/**
 * @param {Function} callback function to run after processing response
 * @param {Error} error response error
 * @param {http.ServerResponse} response collector response from pre connect
 * @returns {void}
 */
CollectorAPI.prototype._onPreConnect = function _onPreConnect(callback, error, response) {
  const agent = this._agent
  if (error || !SUCCESS.has(response.status)) {
    callback(error, response)
    return
  }

  const res = response.payload || Object.create(null)
  this._handlePreConnectResponse(res)

  const policies = res.security_policies || Object.create(null)

  const laspResponse = agent.config.applyLasp(agent, policies)
  if (laspResponse.shouldShutdownRun()) {
    callback(null, laspResponse)
    return
  }

  this._getFacts(laspResponse.payload, callback)
}

/**
 * Checks the redirect_host and determines based on the URL if the collector
 * needs to update the endpoint with new endpoint
 *
 * @param {http.ServerResponse} res collector response
 */
CollectorAPI.prototype._handlePreConnectResponse = function _handlePreConnectResponse(res) {
  const agent = this._agent

  if (!res.redirect_host) {
    logger.error(
      "Requesting this account's collector from %s failed; trying default.",
      agent.config.host
    )
  } else {
    const parts = res.redirect_host.split(':')
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

      const [host, port] = parts
      const newEndpoint = {
        host: host,
        port: port || DEFAULT_PORT
      }

      this._updateEndpoints(newEndpoint)
    }
  }
}

CollectorAPI.prototype._getFacts = function _getFacts(lasp, callback) {
  const agent = this._agent
  const self = this

  facts(agent, function getEnvDict(environmentDict) {
    if (lasp) {
      environmentDict.security_policies = lasp
    }

    // The collector really likes arrays.
    // In fact, it kind of insists on them.
    const environment = [environmentDict]

    self._connect(environment, callback)
  })
}

CollectorAPI.prototype._connect = function _connect(env, callback) {
  const methods = this._methods
  methods.connect.invoke(env, this._onConnect.bind(this, callback))
}

/**
 *
 * Handles the response to the connect call
 *
 * @param {Function} callback function to run after processing response
 * @param {Error} error collector response error
 * @param {http.ServerOptions} res collector response
 */
CollectorAPI.prototype._onConnect = function _onConnect(callback, error, res) {
  const agent = this._agent
  const methods = this._methods

  if (error || !SUCCESS.has(res.status)) {
    callback(error, res)
    return
  }

  const config = res.payload
  if (!config || !config.agent_run_id) {
    callback(new Error('No agent run ID received from handshake.'), res)
    return
  }

  agent.setState('connected')

  logger.info(
    'Connected to %s:%d with agent run ID %s.',
    methods.connect.endpoint.host,
    methods.connect.endpoint.port,
    config.agent_run_id
  )

  // Log "Reporting to..." message from connect response.
  if (config.messages) {
    config.messages.forEach((element) => {
      logger.info(element.message)
    })
  }

  // Store request headers for future collector requests if they're present
  this._reqHeadersMap = config.request_headers_map

  // pass configuration data from the API so automatic reconnect works
  agent.reconfigure(config)

  callback(null, res)
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
      if (error) {
        dumpErrors([error], 'agent_settings')
      }

      if (callback) {
        callback(error, response)
      }
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
 * @returns {void}
 */
CollectorAPI.prototype.error_data = function errorData(errors, callback) {
  if (!callback) {
    this._throwCallbackError()
  }
  if (!errors) {
    callback(new TypeError('must pass errors to send'))
    return
  }

  this._sendData(this._methods.errors, errors, callback)
}

CollectorAPI.prototype.error_event_data = function errorEvents(events, callback) {
  if (!callback) {
    this._throwCallbackError()
  }
  if (!events) {
    callback(new TypeError('must pass errors to send'))
    return
  }

  this._sendData(this._methods.errorEvents, events, callback)
}

CollectorAPI.prototype.analytic_event_data = transactionEvents

/**
 * @param {Array} events list of events to send to collector
 * @param {Function} callback handler on response
 * @returns {void}
 */
function transactionEvents(events, callback) {
  if (!callback) {
    this._throwCallbackError()
  }
  if (!events) {
    callback(new TypeError('must pass events to send'))
    return
  }

  this._sendData(this._methods.events, events, callback)
}

CollectorAPI.prototype.custom_event_data = function customEvents(events, callback) {
  if (!callback) {
    this._throwCallbackError()
  }
  if (!events) {
    callback(new TypeError('must pass events to send'))
    return
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
    this._throwCallbackError()
  }
  if (!metrics) {
    callback(new TypeError('must pass metrics to send'))
    return
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
    this._throwCallbackError()
  }
  if (!queries) {
    callback(new TypeError('must pass queries to send'))
    return
  }
  this._sendData(this._methods.queryData, queries, callback)
}

CollectorAPI.prototype.span_event_data = function spanEvents(events, callback) {
  if (!callback) {
    this._throwCallbackError()
  }
  if (!events) {
    callback(new TypeError('must pass spans to send'))
    return
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

/**
 * @param {Array} traces list of traces to send
 * @param {Function} callback handler on response
 */
function transactionSampleData(traces, callback) {
  if (!callback) {
    this._throwCallbackError()
  }
  if (!traces) {
    callback(new TypeError('must pass traces to send'))
    return
  }

  this._sendData(this._methods.traces, traces, callback)
}

/**
 * Send already-formatted log data by calling log_event_data. For
 * performance reasons, the API methods do no validation, but the
 * collector expects data in an exact format. It expects a JSON array
 * containing the following 2 elements:
 *
 * 1. An array of logs.
 * 2. A list of common attributes(optional).
 *
 * @param {Array} logRecords The encoded log entries.
 * @param {Function} callback The continuation / error handler.
 */
CollectorAPI.prototype.log_event_data = function logEventData(logRecords, callback) {
  if (!callback) {
    this._throwCallbackError()
  }
  if (!logRecords) {
    callback(new TypeError('must pass logRecords to send'))
    return
  }

  this._sendData(this._methods.logEvents, logRecords, callback)
}

/**
 * Sends no data aside from the message itself. Clears the run ID, which
 * effectively disconnects the agent from the collector.
 *
 * @param {Function} callback Runs after the run ID has been cleared.
 */
CollectorAPI.prototype.shutdown = function shutdown(callback) {
  if (!callback) {
    this._throwCallbackError()
  }

  logger.info('Shutting down collector.')

  const agent = this._agent
  this._methods.shutdown.invoke(null, this._reqHeadersMap, onShutdown)

  /**
   * @param {Error} error response error
   * @param {http.ServerResponse} response response from collector
   */
  function onShutdown(error, response) {
    if (error) {
      dumpErrors([error], 'shutdown')
    }

    agent.setState('disconnected')
    logger.info('Disconnected from New Relic; clearing run ID %s.', agent.config.run_id)
    agent.config.run_id = undefined

    callback(error, CollectorResponse.fatal(response && response.payload))
  }
}

CollectorAPI.prototype.restart = function restart(callback) {
  logger.info('Restarting collector.')

  this._agent.stopAggregators()
  const api = this
  this.shutdown(function reconnect() {
    api.connect(function afterConnect() {
      const shouldImmediatelyHarvest = false
      api._agent.onConnect(shouldImmediatelyHarvest, callback)
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
      callback(error)
      return
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

    /*
    if (response.agentRun === AGENT_RUN_BEHAVIOR.SHUTDOWN) {
      // TODO: for now, shut handled in _handleResponseCode for consistency
      // either find way to safely change while side-by-side or move
      // once side-by-side gone. Currently, stop is called twice on the old code path

      // TODO: almost seems better to let aggregator finish (cb) then shutdown?

      // this._agent.stop((err) => {
      //   // TODO: agent stop requires a callback. if we don't care to do anything here
      //   // do we loosen that requirement or perhaps have a different "shutdown"
      //   // method? Does seem like you'd want to log a shutdown error
      //   // but don't really care about that *here*
      // })

      callback(null, { retainData: response.retainData })
      */
    if (response.agentRun === AGENT_RUN_BEHAVIOR.RESTART) {
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

        callback(null, { retainData: response.retainData })
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

CollectorAPI.prototype._handleResponseCode = _handleResponseCode

/**
 * Returns appropriate CollectorResponse object according to response code.
 *
 * @param {http.ServerResponse} response response from collector
 * @param {number} response.status  - Status code from collector response
 * @param {object} response.payload - Parsed response body, if any
 * @param {string} endpoint         - Collector endpoint name
 * @param {Function} cb             - CollectorAPI method invocation callback
 */
function _handleResponseCode(response, endpoint, cb) {
  const code = response.status

  /* eslint-disable padded-blocks */
  if (SUCCESS.has(code)) {
    // The request was a success!
    setImmediate(cb, null, CollectorResponse.success(response.payload))
  } else if (RESTART.has(code)) {
    // The agent needs to disconnect and restart.
    logFailure(endpoint, code, 'Restarting')
    setImmediate(cb, null, CollectorResponse.reconnect(0, null))
  } else if (FAILURE_DISCARD_DATA.has(code)) {
    // Something was wrong with our payload so we must delete our data.
    logFailure(endpoint, code, 'Discarding harvest data')
    setImmediate(cb, null, CollectorResponse.discard(null))
  } else if (FAILURE_SAVE_DATA.has(code)) {
    // Something was wrong with the request, but it wasn't our fault. We'll try again.
    logFailure(endpoint, code, 'Retaining data for next harvest')
    setImmediate(cb, null, CollectorResponse.error(response.payload))
  } else if (code === 410) {
    // New Relic doesn't like us and we shouldn't try to talk to them any more.
    logFailure(endpoint, code, 'Disconnecting from New Relic')

    this._agent.stop(function onShutdown() {
      cb(null, CollectorResponse.fatal(response.payload))
    })
  } else {
    // We're not sure what New Relic is trying to tell us. Let's get rid of our
    // data just in case it is our fault.
    logger.error('Agent endpoint %s returned unexpected status %s.', endpoint, code)
    setImmediate(cb, null, CollectorResponse.discard(null))
  }
}

/**
 * @param {string} endpoint called endpoint
 * @param {string} code http status code
 * @param {string} action describes collector action
 */
function logFailure(endpoint, code, action) {
  logger.error('Agent endpoint %s returned %s status. %s.', endpoint, code, action)
}

module.exports = CollectorAPI
