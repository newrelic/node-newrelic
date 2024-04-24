/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('path')
const fs = require('fs').promises
const Agent = require('../../lib/agent')
const API = require('../../api')
const params = require('../lib/params')
const zlib = require('zlib')
const copy = require('../../lib/util/copy')
const { defaultAttributeConfig } = require('./fixtures')
const { EventEmitter } = require('events')
const Transaction = require('../../lib/transaction')
const symbols = require('../../lib/symbols')
const InstrumentationTracker = require('../../lib/instrumentation-tracker')
const { removeModules } = require('./cache-buster')
const http = require('http')
const https = require('https')
const semver = require('semver')
const crypto = require('crypto')
const util = require('util')

const KEYPATH = path.join(__dirname, 'test-key.key')
const CERTPATH = path.join(__dirname, 'self-signed-test-certificate.crt')
const CAPATH = path.join(__dirname, 'ca-certificate.crt')

let _agent = null
let _agentApi = null
const tasks = []
// Load custom tap assertions
require('./custom-assertions')

const helper = module.exports

function FakeTx() {}

FakeTx.prototype.getFullName = function () {
  return this.name
}

helper.FakeTransaction = function FakeTransaction(agent, url = null) {
  let transaction = {}
  if (agent) {
    transaction = new Transaction(agent)
  } else {
    transaction = new FakeTx()
  }

  transaction.url = url
  transaction.name = 'FakeTransaction'
  transaction.addDistributedTraceIntrinsics = () => {}
  return transaction
}

helper.FakeSegment = function FakeSegment(transaction, duration, name = 'FakeSegment') {
  this.transaction = transaction
  this.attributes = {}
  this.name = name
  this.addAttribute = function addAttribute(key, value) {
    this.attributes[key] = value
  }
  this.getAttributes = () => this.attributes
  this.getDurationInMillis = function getDurationInMillis() {
    return duration
  }
}

helper.SSL_HOST = 'localhost'
helper.getAgent = () => _agent
helper.getContextManager = () => _agent && _agent._contextManager

/**
 * Set up an agent that won't try to connect to the collector, but also
 * won't instrument any calling code.
 *
 * @param {object} conf Any configuration to override in the agent.
 *                      See agent.js for details, but so far this includes
 *                      passing in a config object and the connection stub
 *                      created in this function.
 * @returns {Agent} Agent with a stubbed configuration.
 */
helper.loadMockedAgent = function loadMockedAgent(conf, setState = true) {
  if (_agent) {
    throw _agent.__created
  }

  // agent needs a 'real' configuration
  const configurator = require('../../lib/config')
  const config = configurator.createInstance(conf)

  if (!config.debug) {
    config.debug = {}
  }

  // adds link to parents node in traces for easier testing
  config.debug.double_linked_transactions = true

  // stub applications
  config.applications = () => ['New Relic for Node.js tests']

  _agent = new Agent(config)
  _agent.__created = new Error('Only one agent at a time! This one was created at:')
  _agent.recordSupportability = () => {} // Stub supportabilities.

  if (setState) {
    _agent.setState('started')
  }

  return _agent
}

helper.getAgentApi = function getAgentApi() {
  // TODO: this needs moar safety, maybe different style based on how this helper is compared to test utils
  if (!_agentApi) {
    _agentApi = new API(_agent)
  }

  return _agentApi
}

/**
 * Generate the URLs used to talk to the collector, which have a very
 * specific format. Useful with nock.
 *
 * @param {String} method The method being invoked on the collector.
 * @param number runID  Agent run ID (optional).
 *
 * @returns {String} URL path for the collector.
 */
helper.generateCollectorPath = function generateCollectorPath(method, runID, protocolVersion) {
  protocolVersion = protocolVersion || 17
  let fragment =
    '/agent_listener/invoke_raw_method?' +
    `marshal_format=json&protocol_version=${protocolVersion}&` +
    `license_key=license%20key%20here&method=${method}`

  if (runID) {
    fragment += '&run_id=' + runID
  }

  return fragment
}

helper.generateAllPaths = (runId) => {
  return {
    CONNECT: helper.generateCollectorPath('connect'),
    CUSTOM_EVENTS: helper.generateCollectorPath('custom_event_data', runId),
    ERRORS: helper.generateCollectorPath('error_data', runId),
    ERROR_EVENTS: helper.generateCollectorPath('error_event_data', runId),
    EVENTS: helper.generateCollectorPath('analytic_event_data', runId),
    LOGS: helper.generateCollectorPath('log_event_data', runId),
    METRICS: helper.generateCollectorPath('metric_data', runId),
    PRECONNECT: helper.generateCollectorPath('preconnect'),
    QUERIES: helper.generateCollectorPath('sql_trace_data', runId),
    SETTINGS: helper.generateCollectorPath('agent_settings', runId),
    SHUTDOWN: helper.generateCollectorPath('shutdown', runId),
    SPAN_EVENTS: helper.generateCollectorPath('span_event_data', runId),
    TRACES: helper.generateCollectorPath('transaction_sample_data', runId)
  }
}

/**
 * Builds on loadMockedAgent by patching the module loader and setting up
 * the instrumentation framework.
 *
 * @param {object} conf
 *  Any configuration to override in the agent. See agent.js for details,
 *  but so far this includes passing in a config object and the connection
 *  stub created in this function.
 *
 * @param {boolean} [setState=true]
 *  Initializes agent's state to 'started', enabling data collection.
 *
 * @returns {Agent} Agent with a stubbed configuration.
 */
helper.instrumentMockedAgent = (conf, setState = true, shimmer = require('../../lib/shimmer')) => {
  shimmer.debug = true

  const agent = helper.loadMockedAgent(conf, setState)

  shimmer.bootstrapInstrumentation(agent)
  shimmer.registerHooks(agent)
  helper.maybeLoadSecurityAgent(agent)

  return agent
}

/**
 * Helper to check if security agent should be loaded
 *
 * @param {Agent} Agent with a stubbed configuration
 * @returns {boolean}
 */
helper.isSecurityAgentEnabled = function isSecurityAgentEnabled(agent) {
  return agent.config?.security?.agent?.enabled
}

/**
 * Checks if security agent _should_ be loaded
 * and requires it and calls start
 *
 * @param {Agent} Agent with a stubbed configuration
 */
helper.maybeLoadSecurityAgent = function maybeLoadSecurityAgent(agent) {
  if (helper.isSecurityAgentEnabled(agent)) {
    agent.config.security.enabled = true
    const api = helper.getAgentApi(agent)
    require('@newrelic/security-agent').start(api)
  }
}

/**
 * Checks if security agent is loaded and deletes all
 * files in its require cache so it can be re-loaded
 *
 * @param {Agent} Agent with a stubbed configuration
 */
helper.maybeUnloadSecurityAgent = function maybeUnloadSecurityAgent(agent) {
  if (helper.isSecurityAgentEnabled(agent)) {
    removeModules(['@newrelic/security-agent'])
  }
}

/**
 * Shut down the agent, ensuring that any instrumentation scaffolding
 * is shut down.
 *
 * @param Agent agent The agent to shut down.
 */
helper.unloadAgent = (agent, shimmer = require('../../lib/shimmer')) => {
  agent.emit('unload')
  shimmer.removeHooks()
  shimmer.unwrapAll()
  shimmer.registeredInstrumentations = new InstrumentationTracker()
  shimmer.debug = false
  helper.maybeUnloadSecurityAgent(agent)

  // Stop future harvesting by aggregators.
  agent.harvester.stop()

  if (agent === _agent) {
    _agent = null
    _agentApi = null
  }
}

helper.loadTestAgent = (t, conf, setState = true) => {
  const agent = helper.instrumentMockedAgent(conf, setState)
  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  return agent
}

/**
 * Create a transactional scope in which instrumentation that will only add
 * trace segments to existing transactions will funciton.
 *
 * If the agent hasn't been started, set to a state that can collect transactions.
 *
 * @param {Agent} agent The agent whose tracer should be used to create the
 *                      transaction.
 * @param {Function} callback The function to be run within the transaction.
 */
helper.runInTransaction = (agent, type, callback) => {
  if (!callback && typeof type === 'function') {
    callback = type
    type = undefined
  }
  if (!(agent && callback)) {
    throw new TypeError('Must include both agent and function!')
  }
  type = type || 'web'

  // if the agent hasn't been started, set to a state that can collect transactions.
  // do not override states for an agent that is already started or in the
  // process of starting.
  if (agent._state === 'stopped') {
    agent.setState('started')
  }

  return agent.tracer.transactionNestProxy(type, () => {
    const transaction = agent.getTransaction()
    return callback(transaction)
  })() // <-- invoke immediately
}

/**
 * Proxy for runInTransaction that names the transaction that the
 * callback is executed in
 */
helper.runInNamedTransaction = (agent, type, callback) => {
  if (!callback && typeof type === 'function') {
    callback = type
    type = undefined
  }

  return helper.runInTransaction(agent, type, (transaction) => {
    transaction.name = 'TestTransaction'
    return callback(transaction)
  })
}

helper.runInSegment = (agent, name, callback) => {
  const tracer = agent.tracer

  return tracer.addSegment(name, null, null, null, callback)
}

/**
 * Stub to bootstrap a memcached instance
 *
 * @param {Function} callback The operations to be performed while the server
 *                            is running.
 */
helper.bootstrapMemcached = (callback) => {
  const Memcached = require('memcached')
  const memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)
  memcached.flush((err) => {
    memcached.end()
    callback(err)
  })
}

/**
 * Select Redis DB index and flush entries in it.
 *
 * @param {redis} [redis]
 * @param {number} dbIndex
 * @param {function} callback
 *  The operations to be performed while the server is running.
 */
helper.flushRedisDb = (client, dbIndex) => {
  return new Promise((resolve, reject) => {
    client.select(dbIndex, (err) => {
      if (err) {
        client.end(true)
        reject(err)
      }

      client.flushdb((err) => {
        if (err) {
          reject(err)
        }

        resolve()
      })
    })
  })
}

helper.withSSL = () => {
  return Promise.all([fs.readFile(KEYPATH), fs.readFile(CERTPATH), fs.readFile(CAPATH)])
}

helper.randomPort = (callback) => {
  const net = require('net')
  // Min port: 1024 (without root)
  // Max port: 65535
  // Our range: 1024-65024
  const port = crypto.randomInt(1024, 65024)
  const server = net
    .createServer()
    .once('listening', () => {
      server.close(() => {
        process.nextTick(callback.bind(null, port))
      })
    })
    .once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        helper.randomPort(callback)
      } else {
        throw err
      }
    })
  server.listen(port)
}

helper.startServerWithRandomPortRetry = (server, maxAttempts = 5) => {
  let attempts = 0
  server.on('error', (e) => {
    // server port not guranteed to be not in use
    if (e.code === 'EADDRINUSE') {
      if (attempts >= maxAttempts) {
        // eslint-disable-next-line no-console
        console.log('Exceeded max attempts (%s), bailing out.', maxAttempts)
        throw new Error('Unable to get unused port')
      }

      attempts++

      // eslint-disable-next-line no-console
      console.log('Address in use, retrying...')
      setTimeout(() => {
        server.close()

        // start the server using a random port
        server.listen()
      }, 1000)
    }
  })

  server.listen()
}

/**
 * Get the appropriate request method.
 * If you pass in ca(certificate authority) we assume
 * you want to make a https request. Also since this
 * request is made after instrumentation is registered
 * we want to make sure we get the original library and not
 * our instrumented one
 */
helper.getRequestLib = function getRequestLib(ca) {
  const request = ca ? https.request : http.request
  return request[symbols.original] || request
}

/**
 * Make http get request via callback
 *
 * @param {string} url path to request
 * @param {object} options http options
 * @param {Function} callback function to execute after request
 */
helper.makeGetRequest = (url, options, callback) => {
  helper.makeRequest(url, options, callback)
}

/**
 * Make http get request via callback
 *
 * @param {string} url path to request
 * @param {object} options http options
 * @returns {Promise} promise with response on resolve/reject
 */
helper.makeGetRequestAsync = util.promisify(helper.makeGetRequest)

helper.makeRequest = (url, options, callback) => {
  if (!options || typeof options === 'function') {
    callback = options
    options = {}
  }

  const request = helper.getRequestLib(options.ca)
  const req = request(url, options, function requestCb(res) {
    const contentType = res.headers['content-type']
    let rawData = ''

    res.on('data', (chunk) => {
      rawData += chunk
    })

    res.on('end', () => {
      if (typeof callback === 'function') {
        const body = contentType?.includes('application/json') ? JSON.parse(rawData) : rawData
        // assign body to res as when this method is promisified it can only return 2 args: err, result
        res.body = body
        callback(null, res, body)
      }
    })
  }).on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      this.makeGetRequest(url, options, callback)
    } else {
      callback(err)
    }
  })

  if (options.method === 'POST' && options.body) {
    req.write(options.body)
  }

  req.end()
}

helper.temporarilyRemoveListeners = (t, emitter, evnt) => {
  if (!emitter) {
    t.comment('Not removing %s listeners, emitter does not exist', evnt)
    return
  }

  t.comment('Removing listeners for %s', evnt)
  let listeners = emitter.listeners(evnt)
  t.teardown(() => {
    t.comment('Re-adding listeners for %s', evnt)
    listeners.forEach((fn) => {
      emitter.on(evnt, fn)
    })
    listeners = []
  })
  emitter.removeAllListeners(evnt)
}

/**
 * Tap will prevent certain uncaughtException behaviors from occuring
 * and adds extra properties. This bypasses that.
 * While t.expectUncaughtException seems intended for a similar use case,
 * it does not seem to work appropriately for some of our use casese.
 */
helper.temporarilyOverrideTapUncaughtBehavior = (tap, t) => {
  const originalThrew = tap.threw
  // Prevent tap from failing test and remove extra prop
  tap.threw = (err) => {
    delete err.tapCaught
  }

  const originalTestThrew = t.threw
  t.threw = (err) => {
    delete err.tapCaught
  }

  t.teardown(() => {
    t.threw = originalTestThrew
    tap.threw = originalThrew
  })
}

/**
 * Set up an unref'd loop to execute tasks that are added
 * via helper.runOutOfContext
 */
helper.outOfContextQueueInterval = setInterval(() => {
  while (tasks.length) {
    tasks.pop()()
  }
}, 25).unref()

/**
 * Adds a function to the outOfContext interval
 * above
 *
 * @param {Function} fn to execute
 */
helper.runOutOfContext = function runOutOfContext(fn) {
  tasks.push(fn)
}

helper.decodeServerlessPayload = (t, payload, cb) => {
  if (!payload) {
    t.comment('No payload to decode')
    return cb()
  }

  zlib.gunzip(Buffer.from(payload, 'base64'), (err, decompressed) => {
    if (err) {
      t.comment('Error occurred when decompressing payload')
      return cb(err)
    }

    let parsed = null
    try {
      parsed = JSON.parse(decompressed)
      cb(null, parsed)
    } catch (err) {
      cb(err)
    }
  })
}

helper.makeAttributeFilterConfig = (rules = {}) => {
  rules = copy.shallow(rules, defaultAttributeConfig())
  return copy.shallow(rules, new EventEmitter())
}

helper.getMetrics = function getMetrics(agent) {
  return agent.metrics._metrics
}

/**
 * Asserts the wrapped callback is wrapped and the unwrapped version is the original.
 * It also verifies it does not throw an error
 *
 * @param {object} shim shim lib
 * @param {Function} original callback
 */
helper.checkWrappedCb = function checkWrappedCb(shim, cb) {
  // The wrapped calledback is always the last argument
  const wrappedCB = arguments[arguments.length - 1]
  this.not(wrappedCB, cb)
  this.ok(shim.isWrapped(wrappedCB))
  this.equal(shim.unwrap(wrappedCB), cb)

  this.doesNotThrow(function () {
    wrappedCB()
  })

  this.end()
}

/**
 * Unwraps one or more items, revealing the original value.
 *
 * - `unwrap(nodule, property)`
 * - `unwrap(func)`
 *
 * If called with a `nodule` and properties, the unwrapped values will be put
 * back on the nodule. Otherwise, the unwrapped function is just returned.
 *
 * @param {object | Function} nodule
 *  The source for the properties to unwrap, or a single function to unwrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to unwrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to unwrap.
 * @returns {object | Function} The first parameter after unwrapping.
 */
helper.unwrap = function unwrap(nodule, properties) {
  // Don't try to unwrap potentially `null` or `undefined` things.
  if (!nodule) {
    return nodule
  }

  // If we're unwrapping multiple things
  if (Array.isArray(properties)) {
    properties.forEach(module.exports.unwrap.bind(this, nodule))
    return nodule
  }

  let original = properties ? nodule[properties] : nodule
  while (original && original[symbols.original]) {
    original =
      original[symbols.unwrap] instanceof Function
        ? original[symbols.unwrap]()
        : original[symbols.original]
  }
  return original
}

/**
 * Util that checks if current node version is supported
 * @param {string} version semver version string
 * @returns {boolean} if version is supported
 */
helper.isSupportedVersion = function isSupportedVersion(version) {
  return semver.gt(process.version, version)
}

/**
 * The https-proxy-server we support finally supports keep alive
 * See: https://github.com/TooTallNate/proxy-agents/pull/147
 * In order for tap to shutdown we must destroy the https agent.
 * This assumes the agent already exists as a singleton so we can destroy
 * the active http agent
 */
helper.destroyProxyAgent = function destroyProxyAgent() {
  require('../../lib/collector/http-agents').proxyAgent().destroy()
}

/**
 * Gets a shim instance for a package.
 * @param {object} pkg exported obj that is instrumented
 * @returns The existing or newly created shim.
 */
helper.getShim = function getShim(pkg) {
  return pkg?.[symbols.shim]
}
