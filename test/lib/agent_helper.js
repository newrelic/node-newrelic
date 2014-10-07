'use strict'

var path      = require('path')
  , fs        = require('fs')
  , extend    = require('util')._extend
  , architect = require('architect')
  , MongoClient = require('mongodb').MongoClient
  , async     = require('async')
  , redis     = require('redis')
  , Memcached = require('memcached')
  , shimmer   = require('../../lib/shimmer')
  , Agent     = require('../../lib/agent')
  , params    = require('../lib/params')


/*
 * CONSTANTS
 */

var KEYPATH  = path.join(__dirname, 'test-key.key')
  , CERTPATH = path.join(__dirname, 'self-signed-test-certificate.crt')
  , CAPATH   = path.join(__dirname, 'ca-certificate.crt')


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
      , config       = configurator.initialize(conf)

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
      'marshal_format=json&protocol_version=12&' +
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

    if (agent === _agent) _agent = null
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
    })(); // <-- invoke immediately
  },

  /**
   * Stub to bootstrap a memcached instance
   *
   * @param Function callback The operations to be performed while the server
   *                          is running.
   */
  bootstrapMemcached : function bootstrapMemcached(callback) {
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
    MongoClient.connect('mongodb://' + params.mongodb_host + ':' + params.mongodb_port + '/integration', function(err, db) {
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
