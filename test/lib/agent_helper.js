/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Agent = require('../../lib/agent')
const API = require('../../api')
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
const cp = require('child_process')
const fs = require('node:fs')
const path = require('node:path')

let _agent = null
let _agentApi = null
const tasks = []

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
helper.getTracer = () => _agent?.tracer

/**
 * Set up an agent that won't try to connect to the collector, but also
 * won't instrument any calling code.
 *
 * @param {object} conf Any configuration to override in the agent.
 *                      See agent.js for details, but so far this includes
 *                      passing in a config object and the connection stub
 *                      created in this function.
 * @param {boolean} setState defaults to true
 * @returns {Agent} Agent with a stubbed configuration.
 */
helper.loadMockedAgent = function loadMockedAgent(conf, setState = true) {
  if (_agent) {
    throw _agent.__created
  }

  // agent needs a 'real' configuration
  const configurator = require('../../lib/config')
  const config = configurator.createInstance(conf)
  // stub applications
  config.applications = () => ['New Relic for Node.js tests']

  _agent = new Agent(config)
  _agent.__created = new Error('Only one agent at a time! This one was created at:')
  _agent.__mocks = {
    supportability: new Map()
  }
  _agent.recordSupportability = (key) => { // Stub supportabilities.
    if (!_agent) {
      // It's possible that a test has finished before this method is invoked,
      // and that the post test clean up will have unloaded the agent. In that
      // case, we don't have an agent instance any longer and just need to
      // bail out.
      return
    }
    const val = _agent.__mocks.supportability.get(key)
    if (val) {
      _agent.__mocks.supportability.set(key, val + 1)
    } else {
      _agent.__mocks.supportability.set(key, 1)
    }
  }

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
 * @param {string} method The method being invoked on the collector.
 * @param {number} runID  Agent run ID (optional).
 * @param {number} [protocolVersion] defaults to 17
 * @returns {string} URL path for the collector.
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
 * @param {boolean} [setState]
 *  Initializes agent's state to 'started', enabling data collection.
 *
 * @param {object} shimmer shimmer instance; defaults to #agentlib/shimmer
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
 * @param {Agent} agent with a stubbed configuration
 * @returns {boolean}
 */
helper.isSecurityAgentEnabled = function isSecurityAgentEnabled(agent) {
  return agent.config?.security?.agent?.enabled
}

/**
 * Checks if security agent _should_ be loaded
 * and requires it and calls start
 *
 * @param {Agent} agent with a stubbed configuration
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
 * @param {Agent} agent with a stubbed configuration
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
 * @param {Agent} agent The agent to shut down.
 * @param {object} [shimmer] The shimmer to use.
 */
helper.unloadAgent = (agent, shimmer = require('../../lib/shimmer')) => {
  agent.emit('unload')
  shimmer.removeHooks(agent)
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
  if (t.after) {
    t.after(() => {
      helper.unloadAgent(agent)
    })
  } else {
    t.teardown(() => {
      helper.unloadAgent(agent)
    })
  }

  return agent
}

/**
 * Create a transactional scope in which instrumentation that will only add
 * trace segments to existing transactions will function.
 *
 * If the agent hasn't been started, set to a state that can collect transactions.
 *
 * @param {Agent} agent The agent whose tracer should be used to create the
 *                      transaction.
 * @param {string} [type] Indicates the class of the transaction.
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
 * @param {Agent} agent instance
 * @param {string} type the class of the transaction
 * @param {Function} callback function to be called within the transaction
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
  const parent = tracer.getSegment()

  return tracer.addSegment(name, null, parent, null, callback)
}

/**
 * Select Redis DB index and flush entries in it.
 *
 * @param {object} client Redis client
 * @param {number} dbIndex
 *  The operations to be performed while the server is running.
 */
helper.flushRedisDb = (client, dbIndex) => new Promise((resolve, reject) => {
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
    // server port not guaranteed to be not in use
    if (e.code === 'EADDRINUSE') {
      if (attempts >= maxAttempts) {
        console.log('Exceeded max attempts (%s), bailing out.', maxAttempts)
        throw new Error('Unable to get unused port')
      }

      attempts++

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
 * @param {object} ca certificate authority
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

helper.decodeServerlessPayload = (payload, cb) => {
  if (!payload) {
    return cb()
  }

  zlib.gunzip(Buffer.from(payload, 'base64'), (err, decompressed) => {
    if (err) {
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
 * @param {Function} cb original callback
 */
helper.checkWrappedCb = function checkWrappedCb(shim, cb) {
  // The wrapped callback is always the last argument
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
 * Gets a shim instance for a package.
 * @param {object} pkg exported obj that is instrumented
 * @returns {Shim} The existing or newly created shim.
 */
helper.getShim = function getShim(pkg) {
  return pkg?.[symbols.shim]
}

/**
 * Executes a file in a child_process. This is intended to be
 * used when you have to test destructive behavior that would be caught
 * by `node:test`
 *
 * @param {object} params to function
 * @param {string} params.cwd working directory of script
 * @param {string} params.script script name
 */
helper.execSync = function execSync({ cwd, script }) {
  try {
    // eslint-disable-next-line sonarjs/os-command
    cp.execSync(`node ./${script}`, {
      stdio: 'pipe',
      encoding: 'utf8',
      cwd
    })
  } catch (err) {
    throw err.stderr
  }
}

/**
 * Used to get version from package.json.
 * Some packages define exports and omit `package.json` so `require` or `import`
 * will fail when trying to read package.json. This instead just reads file and parses to json
 *
 * @param {string} dirname value of `__dirname` in caller
 * @param {string} pkg name of package
 * @returns {string} package version
 */
helper.readPackageVersion = function readPackageVersion(dirname, pkg) {
  const parsedPath = path.join(dirname, 'node_modules', pkg, 'package.json')
  const packageFile = fs.readFileSync(parsedPath)
  const { version } = JSON.parse(packageFile)
  return version
}

/**
 * Creates a random string prefixed with the provided value
 * @param {string} prefix value to prefix random string
 * @returns {string} random string
 */
helper.randomString = function randomString(prefix = '') {
  return `${prefix}${crypto.randomBytes(8).toString('hex')}`
}
