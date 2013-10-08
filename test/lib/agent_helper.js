'use strict';

var path                = require('path')
  , fs                  = require('fs')
  , sinon               = require('sinon')
  , architect           = require('architect')
  , wrench              = require('wrench')
  , logger              = require(path.join(__dirname, '..', '..', 'lib', 'logger'))
                            .child({component : 'agent_helper'})
  , shimmer             = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  , Agent               = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  , CollectorConnection = require(path.join(__dirname, '..', '..', 'lib',
                                            'collector', 'connection'))
  ;

/*
 * CONSTANTS
 */

var KEYPATH  = path.join(__dirname, 'test-key.key')
  , CERTPATH = path.join(__dirname, 'self-signed-test-certificate.crt')
  , CAPATH   = path.join(__dirname, 'ca-certificate.crt')
  ;

var _agent;

var helper = module.exports = {
  /**
   * Set up an agent that won't try to connect to the collector, but also
   * won't instrument any calling code.
   *
   * @param object options Any configuration to override in the agent.
   *                       See agent.js for details, but so far this includes
   *                       passing in a config object and the connection stub
   *                       created in this function.
   * @returns Agent Agent with a mocked connection method.
   */
  loadMockedAgent : function loadMockedAgent(options) {
    if (!options) options = {};
    if (_agent) throw _agent.__created;

    // agent needs a "real" configuration
    var configurator = require(path.join(__dirname, '..', '..', 'lib', 'config'))
      , config       = configurator.initialize(logger)
      ;
    // stub applications
    config.applications = function fakedApplications() { return 'none'; };

    var connection = new CollectorConnection({ config : config });

    sinon.stub(connection, 'connect');
    options.connection = connection;

    _agent = new Agent(config, options);
    _agent.__created = new Error("Only one agent at a time! This one was created at:");
    _agent.setupConnection();

    return _agent;
  },

  /**
   * Builds on loadMockedAgent by patching the module loader and setting up
   * the instrumentation framework.
   *
   * @returns Agent Agent with a mocked connection method.
   */
  instrumentMockedAgent : function instrumentMockedAgent() {
    shimmer.debug = true;

    var agent = helper.loadMockedAgent();
    shimmer.patchModule(agent);
    shimmer.bootstrapInstrumentation(agent);

    return agent;
  },

  /**
   * Shut down the agent, ensuring that any instrumentation scaffolding
   * is shut down.
   *
   * @param Agent agent The agent to shut down.
   */
  unloadAgent : function unloadAgent(agent) {
    agent.stop();
    shimmer.unpatchModule();
    shimmer.unwrapAll();
    shimmer.debug = false;

    if (agent === _agent) _agent = null;
  },

  /**
   * Create a transactional scope in which instrumentation that will only add
   * trace segments to existing transactions will funciton.
   *
   * @param Agent agent The agent whose tracer should be used to create the
   *                    transaction.
   * @param Function callback The function to be run within the transaction.
   */
  runInTransaction : function runInTransaction(agent, callback) {
    if (!(agent && callback)) {
      throw new TypeError("Must include both agent and function!");
    }

    return agent.tracer.transactionProxy(function () {
      var transaction = agent.getTransaction();
      callback(transaction);
    })(); // <-- invoke immediately
  },

  /**
   * Use c9/architect to bootstrap a memcached server for running integration
   * tests.
   *
   * @param Function callback The operations to be performed while the server
   *                          is running.
   */
  bootstrapMemcached : function bootstrapMemcached(callback) {
    var memcached = path.join(__dirname, 'architecture', 'memcached.js');
    var config = architect.loadConfig(memcached);
    architect.createApp(config, function (error, app) {
      if (error) return helper.cleanMemcached(app, function () {
        return callback(error);
      });

      return callback(null, app);
    });
  },

  /**
   * Shut down and clean up after memcached.
   *
   * @param Object app The architect app to be shut down.
   * @param Function callback The operations to be run after the server is
   *                          shut down.
   */
  cleanMemcached : function cleanMemcached(app, callback) {
    var memcached = app.getService('memcachedProcess');
    memcached.shutdown(callback);
  },

  /**
   * Use c9/architect to bootstrap a MongoDB server for running integration
   * tests.
   *
   * @param Function callback The operations to be performed while the server
   *                          is running.
   */
  bootstrapMongoDB : function bootstrapMongoDB(callback) {
    var bootstrapped = path.join(__dirname, 'architecture', 'mongodb-bootstrapped.js');
    var config = architect.loadConfig(bootstrapped);
    architect.createApp(config, function (error, app) {
      if (error) return helper.cleanMongoDB(app, function () { return callback(error); });

      return callback(null, app);
    });
  },

  cleanMongoDB : function cleanMongoDB(app, callback) {
    var mongod = app.getService('mongodbProcess');
    mongod.shutdown(function () {
      wrench.rmdirSyncRecursive(path.join(__dirname, '..',
                                          'integration', 'test-mongodb'));

      if (callback) return callback();
    });
  },

  /**
   * Use c9/architect to bootstrap a MySQL server for running integration
   * tests. Will create a blank data directory, meant to be paired with
   * cleanMySQL.
   *
   * @param Function callback The operations to be performed while the server
   *                          is running.
   */
  bootstrapMySQL : function bootstrapMySQL(callback) {
    var bootstrapped = path.join(__dirname, 'architecture', 'mysql-bootstrapped.js');
    var config = architect.loadConfig(bootstrapped);
    architect.createApp(config, function (error, app) {
      if (error) return helper.cleanMySQL(app, function () { return callback(error); });

      return callback(null, app);
    });
  },

  cleanMySQL : function cleanMySQL(app, callback) {
    var mysqld = app.getService('mysqldProcess');
    mysqld.shutdown(function () {
      wrench.rmdirSyncRecursive(path.join(__dirname, '..', 'integration', 'test-mysql'));

      if (callback) return callback();
    });
  },

  /**
   * Use c9/architect to bootstrap a Redis server for running integration
   * tests.
   *
   * @param Function callback The operations to be performed while the server
   *                          is running.
   */
  bootstrapRedis : function bootstrapRedis(callback) {
    var redis = path.join(__dirname, 'architecture', 'redis.js');
    var config = architect.loadConfig(redis);
    architect.createApp(config, function (error, app) {
      if (error) return helper.cleanRedis(app, function () {
        return callback(error);
      });

      return callback(null, app);
    });
  },

  cleanRedis : function cleanRedis(app, callback) {
    var redis = app.getService('redisProcess');
    redis.shutdown(callback);
  },

  withSSL : function (callback) {
    fs.readFile(KEYPATH, function (error, key) {
      if (error) return callback(error);

      fs.readFile(CERTPATH, function (error, certificate) {
        if (error) return callback(error);

        fs.readFile(CAPATH, function (error, ca) {
          if (error) return callback(error);

          callback(null, key, certificate, ca);
        });
      });
    });
  },

  // FIXME: I long for the day I no longer need this gross hack
  onlyDomains : function () {
    var exceptionHandlers = process._events['uncaughtException'];
    if (exceptionHandlers) {
      if (Array.isArray(exceptionHandlers)) {
        process._events['uncaughtException'] = exceptionHandlers.filter(function (f) {
          return f.name === 'uncaughtHandler';
        });
      }
      else {
        if (exceptionHandlers.name !== 'uncaughtException') {
          delete process._events['uncaughtException'];
        }
      }
    }

    return exceptionHandlers;
  }
};
