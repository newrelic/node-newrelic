'use strict'

var path = require('path')
var fs = require('fs')
var extend = require('util')._extend
var architect = require('architect')
var async = require('async')
var shimmer = require('../../lib/shimmer')
var Agent = require('../../lib/agent')
var params = require('../lib/params')


/*
 * CONSTANTS
 */

var KEYPATH = path.join(__dirname, 'test-key.key')
var CERTPATH = path.join(__dirname, 'self-signed-test-certificate.crt')
var CAPATH = path.join(__dirname, 'ca-certificate.crt')


var _agent

var helper = module.exports = {
  /**
   * Set up an agent that won't try to connect to the collector, but also
   * won't instrument any calling code.
   *
   * @param object flags   Any feature flags
   * @param object options Any configuration to override in the agent.
   *                       See agent.js for details, but so far this includes
   *                       passing in a config object and the connection stub
   *                       created in this function.
   * @returns Agent Agent with a stubbed configuration.
   */
  loadMockedAgent : function loadMockedAgent(flags, conf) {
    if (_agent) throw _agent.__created

    // agent needs a "real" configuration
    var configurator = require('../../lib/config')
    var config = configurator.initialize(conf)

    if (!config.debug) {
      config.debug = {}
    }

    // adds link to parents node in traces for easier testing
    config.debug.double_linked_transactions = true

    // stub applications
    config.applications = function faked() { return ['New Relic for Node.js tests']; }

    _agent = new Agent(config)
    _agent.__created = new Error("Only one agent at a time! This one was created at:")

    if (flags) {
      var newFlags = extend({}, _agent.config.feature_flag)
      newFlags = extend(newFlags, flags)
      _agent.config.feature_flag = newFlags
    }

    return _agent
  },

  /**
   * Generate the URLs used to talk to the collector, which have a very
   * specific format. Useful with nock.
   *
   * @param String method The method being invoked on the collector.
   * @param number runID  Agent run ID (optional).
   *
   * @returns String URL path for the collector.
   */
  generateCollectorPath : function generateCollectorPath(method, runID) {
    var fragment = '/agent_listener/invoke_raw_method?' +
      'marshal_format=json&protocol_version=14&' +
      'license_key=license%20key%20here&method=' + method

    if (runID) fragment += '&run_id=' + runID

    return fragment
  },

  /**
   * Builds on loadMockedAgent by patching the module loader and setting up
   * the instrumentation framework.
   *
   * @returns Agent Agent with a stubbed configuration.
   */
  instrumentMockedAgent : function instrumentMockedAgent(flags, conf) {
    shimmer.debug = true

    var agent = helper.loadMockedAgent(flags, conf)

    shimmer.patchModule(agent)
    shimmer.bootstrapInstrumentation(agent)
    return agent
  },

  /**
   * Shut down the agent, ensuring that any instrumentation scaffolding
   * is shut down.
   *
   * @param Agent agent The agent to shut down.
   */
  unloadAgent : function unloadAgent(agent) {
    shimmer.unpatchModule()
    shimmer.unwrapAll()
    shimmer.debug = false

    // On v0.8 each mocked agent will add an uncaughtException handler
    // that needs to be removed on unload
    var listeners = process.listeners('uncaughtException')
    for (var i = 0, len = listeners.length; i < len; ++i) {
      var handler = listeners[i]
      if (typeof handler === 'function'
          && handler.name === '__NR_uncaughtExceptionHandler') {
        process.removeListener('uncaughtException', handler)
      }
    }

    if (agent === _agent) _agent = null
  },

  loadTestAgent: function loadTestAgent(t) {
    var agent = helper.instrumentMockedAgent()
    t.tearDown(function tearDown() {
      helper.unloadAgent(agent)
    })

    return agent
  },

  /**
   * Create a transactional scope in which instrumentation that will only add
   * trace segments to existing transactions will funciton.
   *
   * @param Agent agent The agent whose tracer should be used to create the
   *                    transaction.
   * @param Function callback The function to be run within the transaction.
   */
  runInTransaction : function runInTransaction(agent, type, callback) {
    if (callback === undefined && typeof type === 'function') {
      callback = type
      type = undefined
    }
    if (!(agent && callback)) {
      throw new TypeError("Must include both agent and function!")
    }

    return agent.tracer.transactionProxy(function cb_transactionProxy() {
      var transaction = agent.getTransaction()
      callback(transaction)
    })() // <-- invoke immediately
  },

  /**
   * Proxy for runInTransaction that names the transaction that the
   * callback is executed in
   */
  runInNamedTransaction : function runInNamedTransaction(agent, type, callback) {
    if (callback === undefined && typeof type === 'function') {
      callback = type
      type = undefined
    }


    return helper.runInTransaction(agent, type, function wrappedCallback(transaction) {
      transaction.name = 'TestTransaction'
      return callback(transaction)
    })

  },

  /**
   * Stub to bootstrap a memcached instance
   *
   * @param Function callback The operations to be performed while the server
   *                          is running.
   */
  bootstrapMemcached : function bootstrapMemcached(callback) {
    var Memcached = require('memcached')
    var memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)
    memcached.flush(function(err) {
      memcached.end()
      callback(err)
    })
  },

  /**
   * Bootstrap a running MongoDB instance by dropping all the collections used
   * by tests
   *
   * @param Function callback The operations to be performed while the server
   *                          is running.
   */
  bootstrapMongoDB : function bootstrapMongoDB(collections, callback) {
    var mongodb = require('mongodb')
    var server  = new mongodb.Server(params.mongodb_host, params.mongodb_port, {
      auto_reconnect : true
    })
    var db = mongodb.Db('integration', server, {
      w: 1,
      safe : true,
      numberOfRetries: 10,
      wtimeout: 100,
      retryMiliSeconds: 300
    })

    db.open(function(err, db) {
      if (err) return callback(err)

      async.eachSeries(collections, function(collection, callback) {
        db.dropCollection(collection, function(err) {
          // It's ok if the collection didn't exist before
          if (err && err.errmsg === 'ns not found') err = null

          callback(err)
        })
      }, function(err) {
        db.close(function(err2) {
          callback(err || err2)
        })
      })
    })
  },

  /**
   * Use c9/architect to bootstrap a MySQL server for running integration
   * tests.
   *
   * @param Function callback The operations to be performed while the server
   *                          is running.
   */
  bootstrapMySQL : function bootstrapMySQL(callback) {
    var bootstrapped = path.join(__dirname, 'architecture/mysql-bootstrapped.js')
    var config = architect.loadConfig(bootstrapped)
    architect.createApp(config, function (error, app) {
      if (error) return callback(error)

      return callback(null, app)
    })
  },

  /**
   * Select Redis DB index and flush entries in it.
   *
   * @param Function callback The operations to be performed while the server
   *                          is running.
   */
  bootstrapRedis : function bootstrapRedis(db_index, callback) {
    var redis = require('redis')
    var client = redis.createClient(params.redis_port, params.redis_host)
    client.select(db_index, function cb_select(err) {
      if (err) {
        client.end()
        return callback(err)
      }

      client.flushdb(function(err) {
        client.end()

        callback(err)
      })
    })
  },

  withSSL : function (callback) {
    fs.readFile(KEYPATH, function (error, key) {
      if (error) return callback(error)

      fs.readFile(CERTPATH, function (error, certificate) {
        if (error) return callback(error)

        fs.readFile(CAPATH, function (error, ca) {
          if (error) return callback(error)

          callback(null, key, certificate, ca)
        })
      })
    })
  },

  // FIXME: I long for the day I no longer need this gross hack
  onlyDomains : function () {
    var exceptionHandlers = process._events['uncaughtException']
    if (exceptionHandlers) {
      if (Array.isArray(exceptionHandlers)) {
        process._events['uncaughtException'] = exceptionHandlers.filter(function cb_filter(f) {
          return f.name === 'uncaughtHandler'
        })
      }
      else {
        if (exceptionHandlers.name !== 'uncaughtException') {
          delete process._events['uncaughtException']
        }
      }
    }

    return exceptionHandlers
  }
}
