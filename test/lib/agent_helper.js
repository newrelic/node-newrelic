'use strict';

var path                = require('path')
  , sinon               = require('sinon')
  , architect           = require('architect')
  , wrench              = require('wrench')
  , shimmer             = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  , Agent               = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  , CollectorConnection = require(path.join(__dirname, '..', '..', 'lib',
                                            'collector', 'connection'))
  ;

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

    var connection = new CollectorConnection({
      config : {
        applications : function () { return 'none'; }
      }
    });

    sinon.stub(connection, 'connect');
    options.connection = connection;

    var agent = new Agent(options);
    agent.setupConnection();
    return agent;
  },

  /**
   * Builds on loadMockedAgent by patching the module loader and setting up
   * the instrumentation framework.
   *
   * @returns Agent Agent with a mocked connection method.
   */
  instrumentMockedAgent : function instrumentMockedAgent() {
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

      return callback();
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
  }
};
