'use strict'

const path = require('path')
const fs = require('fs')
const architect = require('architect')
const async = require('async')
const shimmer = require('../../lib/shimmer')
const Agent = require('../../lib/agent')
const params = require('../lib/params')
const request = require('request')
const zlib = require('zlib')
const copy = require('../../lib/util/copy')
const {defaultAttributeConfig} = require('./fixtures')
const {EventEmitter} = require('events')

const KEYPATH = path.join(__dirname, 'test-key.key')
const CERTPATH = path.join(__dirname, 'self-signed-test-certificate.crt')
const CAPATH = path.join(__dirname, 'ca-certificate.crt')

let _agent = null
const tasks = []
setInterval(() => {
  while (tasks.length) {
    tasks.pop()()
  }
}, 25).unref()

const helper = module.exports = {
  getAgent: () => _agent,

  /**
   * Set up an agent that won't try to connect to the collector, but also
   * won't instrument any calling code.
   *
   * @param {object} conf    Any configuration to override in the agent.
   *                         See agent.js for details, but so far this includes
   *                         passing in a config object and the connection stub
   *                         created in this function.
   * @returns {Agent} Agent with a stubbed configuration.
   */
  loadMockedAgent: (conf, setState = true) => {
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

    global.__NR_agent = _agent

    if (setState) {
      _agent.setState('started')
    }

    return _agent
  },

  /**
   * Generate the URLs used to talk to the collector, which have a very
   * specific format. Useful with nock.
   *
   * @param {string} method The method being invoked on the collector.
   * @param {number} runID  Agent run ID (optional).
   *
   * @returns {string} URL path for the collector.
   */
  generateCollectorPath: (method, runID, protocolVersion) => {
    protocolVersion = protocolVersion || 17
    let fragment = '/agent_listener/invoke_raw_method?' +
      `marshal_format=json&protocol_version=${protocolVersion}&` +
      `license_key=license%20key%20here&method=${method}`

    if (runID) {
      fragment += '&run_id=' + runID
    }

    return fragment
  },

  generateAllPaths: (runId) => {
    return {
      CONNECT: helper.generateCollectorPath('connect'),
      CUSTOM_EVENTS: helper.generateCollectorPath('custom_event_data', runId),
      ERRORS: helper.generateCollectorPath('error_data', runId),
      ERROR_EVENTS: helper.generateCollectorPath('error_event_data', runId),
      EVENTS: helper.generateCollectorPath('analytic_event_data', runId),
      METRICS: helper.generateCollectorPath('metric_data', runId),
      PRECONNECT: helper.generateCollectorPath('preconnect'),
      QUERIES: helper.generateCollectorPath('sql_trace_data', runId),
      SETTINGS: helper.generateCollectorPath('agent_settings', runId),
      SHUTDOWN: helper.generateCollectorPath('shutdown', runId),
      SPAN_EVENTS: helper.generateCollectorPath('span_event_data', runId),
      TRACES: helper.generateCollectorPath('transaction_sample_data', runId)
    }
  },

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
  instrumentMockedAgent: (conf, setState = true) => {
    shimmer.debug = true

    const agent = helper.loadMockedAgent(conf)

    if (setState) {
      agent.setState('started')
    }

    shimmer.patchModule(agent)
    shimmer.bootstrapInstrumentation(agent)
    return agent
  },

  /**
   * Shut down the agent, ensuring that any instrumentation scaffolding
   * is shut down.
   *
   * @param {Agent} agent The agent to shut down.
   */
  unloadAgent: (agent) => {
    agent.emit('unload')
    shimmer.unpatchModule()
    shimmer.unwrapAll()
    shimmer.debug = false

    // On all versions each agent will add an unhandledRejection handler. This
    // handler needs to be removed on unload.
    removeListenerByName(process, 'unhandledRejection', '__NR_unhandledRejectionHandler')

    // Stop any already scheduled harvests.
    agent._stopHarvester()

    if (agent === _agent) {
      global.__NR_agent = null
      _agent = null
    }
  },

  loadTestAgent: (t, conf, setState = true) => {
    let agent = helper.instrumentMockedAgent(conf, setState)
    t.tearDown(() => {
      helper.unloadAgent(agent)
    })

    return agent
  },

  /**
   * Create a transactional scope in which instrumentation that will only add
   * trace segments to existing transactions will function.
   *
   * If the agent hasn't been started, set to a state that can collect transactions.
   *
   * @param {Agent} agent The agent whose tracer should be used to create the
   *                      transaction.
   * @param {Function} callback The function to be run within the transaction.
   */
  runInTransaction: (agent, type, callback) => {
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
  },

  /**
   * Proxy for runInTransaction that names the transaction that the
   * callback is executed in
   */
  runInNamedTransaction: (agent, type, callback) => {
    if (!callback && typeof type === 'function') {
      callback = type
      type = undefined
    }

    return helper.runInTransaction(agent, type, (transaction) => {
      transaction.name = 'TestTransaction'
      return callback(transaction)
    })
  },

  /**
   * Stub to bootstrap a memcached instance
   *
   * @param {Function} callback The operations to be performed while the server
   *                            is running.
   */
  bootstrapMemcached: (callback) => {
    const Memcached = require('memcached')
    const memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)
    memcached.flush((err) => {
      memcached.end()
      callback(err)
    })
  },

  /**
   * Bootstrap a running MongoDB instance by dropping all the collections used
   * by tests
   *
   * @param {Function} callback The operations to be performed while the server
   *                            is running.
   */
  bootstrapMongoDB: (mongodb, collections, callback) => {
    if (!callback) {
      // bootstrapMongoDB(collections, callback)
      callback = collections
      collections = mongodb
      mongodb = require('mongodb')
    }

    const server = new mongodb.Server(params.mongodb_host, params.mongodb_port, {
      auto_reconnect: true
    })
    const db = new mongodb.Db('integration', server, {
      w: 1,
      safe: true,
      numberOfRetries: 10,
      wtimeout: 100,
      retryMiliSeconds: 300
    })

    db.open((err) => {
      if (err) {
        return callback(err)
      }

      async.eachSeries(collections, (collection, cb) => {
        db.dropCollection(collection, (err) => {
          // It's ok if the collection didn't exist before
          if (err && err.errmsg === 'ns not found') {
            err = null
          }

          cb(err)
        })
      }, (err) => {
        db.close((err2) => {
          callback(err || err2)
        })
      })
    })
  },

  /**
   * Use c9/architect to bootstrap a MySQL server for running integration
   * tests.
   *
   * @param {Function} callback The operations to be performed while the server
   *                            is running.
   */
  bootstrapMySQL: (callback) => {
    const bootstrapped = path.join(__dirname, 'architecture/mysql-bootstrapped.js')
    const config = architect.loadConfig(bootstrapped)
    architect.createApp(config, (error, app) => {
      if (error) {
        return callback(error)
      }

      return callback(null, app)
    })
  },

  /**
   * Select Redis DB index and flush entries in it.
   *
   * @param {redis} [redis]
   * @param {number} dbIndex
   * @param {function} callback
   *  The operations to be performed while the server is running.
   */
  bootstrapRedis: (redis, dbIndex, callback) => {
    if (!callback) {
      // bootstrapRedis(dbIndex, callback)
      callback = dbIndex
      dbIndex = redis
      redis = require('redis')
    }
    const client = redis.createClient(params.redis_port, params.redis_host)
    client.select(dbIndex, (err) => {
      if (err) {
        client.end(true)
        return callback(err)
      }

      client.flushdb((err) => {
        client.end(true)
        callback(err)
      })
    })
  },

  withSSL: (callback) => {
    fs.readFile(KEYPATH, (error, key) => {
      if (error) {
        return callback(error)
      }

      fs.readFile(CERTPATH, (error, certificate) => {
        if (error) {
          return callback(error)
        }

        fs.readFile(CAPATH, (error, ca) => {
          if (error) {
            return callback(error)
          }

          callback(null, key, certificate, ca)
        })
      })
    })
  },

  // FIXME: I long for the day I no longer need this gross hack
  onlyDomains: () => {
    const exceptionHandlers = process._events.uncaughtException
    if (exceptionHandlers) {
      if (Array.isArray(exceptionHandlers)) {
        process._events.uncaughtException = exceptionHandlers.filter((f) => {
          return f.name === 'uncaughtHandler'
        })
      } else if (exceptionHandlers.name !== 'uncaughtException') {
        delete process._events.uncaughtException
      }
    }

    return exceptionHandlers
  },

  randomPort: (callback) => {
    const net = require('net')
    // Min port: 1024 (without root)
    // Max port: 65535
    // Our range: 1024-65024
    const port = Math.ceil(Math.random() * 64000 + 1024)
    const server = net.createServer().once('listening', () => {
      server.close(() => {
        process.nextTick(callback.bind(null, port))
      })
    }).once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        helper.randomPort(callback)
      } else {
        throw err
      }
    })
    server.listen(port)
  },

  makeGetRequest: (url, options, callback) => {
    if (!options || typeof options === 'function') {
      callback = options
      options = {}
    }
    request.get(url, options, function requestCb(error, response, body) {
      if (error && error.code === 'ECONNREFUSED') {
        request.get(url, options, requestCb)
      } else if (typeof callback === 'function') {
        callback(error, response, body)
      }
    })
  },

  temporarilyRemoveListeners: (t, emitter, evnt) => {
    if (!emitter) {
      t.comment('Not removing %s listeners, emitter does not exist', evnt)
      return
    }

    t.comment('Removing listeners for %s', evnt)
    let listeners = emitter.listeners(evnt)
    t.tearDown(() => {
      t.comment('Re-adding listeners for %s', evnt)
      listeners.forEach((fn) => {
        process.on('uncaughtException', fn)
      })
      listeners = []
    })
    emitter.removeAllListeners(evnt)
  },

  runOutOfContext: function(fn) {
    tasks.push(fn)
  },

  decodeServerlessPayload: (t, payload, cb) => {
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
  },

  makeAttributeFilterConfig: (rules = {}) => {
    rules = copy.shallow(rules, defaultAttributeConfig())
    return copy.shallow(rules, new EventEmitter())
  }
}

/**
 * Removes all listeners with the given name from the emitter.
 *
 * @param {EventEmitter}  emitter       - The emitter with listeners to remove.
 * @param {string}        eventName     - The event to search within.
 * @param {string}        listenerName  - The name of the listeners to remove.
 */
function removeListenerByName(emitter, eventName, listenerName) {
  const listeners = emitter.listeners(eventName)
  for (let i = 0, len = listeners.length; i < len; ++i) {
    let listener = listeners[i]
    if (typeof listener === 'function' && listener.name === listenerName) {
      emitter.removeListener(eventName, listener)
    }
  }
}
