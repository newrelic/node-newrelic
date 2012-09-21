'use strict';

var path                = require('path')
  , sinon               = require('sinon')
  , architect           = require('architect')
  , wrench              = require('wrench')
  , shimmer             = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  , Agent               = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  , CollectorConnection = require(path.join(__dirname, '..', '..', 'lib', 'collector', 'connection'))
  ;

var helper = module.exports = {
  loadAgent : function loadAgent(options) {
    var agent = new Agent(options);
    shimmer.wrapAgent(agent);
    shimmer.patchModule(agent);
    return agent;
  },

  unloadAgent : function unloadAgent(agent) {
    agent.stop();
    shimmer.unwrapAll();
  },

  loadMockedAgent : function loadMockedAgent(options) {
    if (!options) options = {};

    var connection = new CollectorConnection({
      config : {
        applications : function () { return 'none'; }
      }
    });

    sinon.stub(connection, 'connect');
    options.connection = connection;

    return helper.loadAgent(options);
  },

  bootstrapMySQL : function bootstrapMySQL(callback) {
    var bootstrapped = path.join(__dirname, 'architecture', 'mysql-bootstrapped.js');
    var config = architect.loadConfig(bootstrapped);
    architect.createApp(config, function (error, app) {
      if (error) return helper.cleanMySQL(app, function () { return callback(error); });

      return callback(null, app);
    });
  },

  cleanMySQL : function cleanMySQL(app, callback) {
    app.destroy();
    // give MySQL a chance to shut down
    process.nextTick(function () {
      wrench.rmdirSyncRecursive(path.join(__dirname, '..', 'integration', 'test-mysql'));

      return callback();
    });
  }
};
