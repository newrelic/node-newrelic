'use strict';

var path                = require('path')
  , sinon               = require('sinon')
  , trace               = require(path.join(__dirname, '..', '..', 'lib', 'trace'))
  , CollectorConnection = require(path.join(__dirname, '..', '..', 'lib', 'collector', 'connection'))
  ;

/*
 * This function is very impolite. It removes a module from the module
 * cache, thus ensuring that a singleton is reset across test runs.
 */
function uncacheModule(pathname) {
  var module   = require('module')
    , resolved = module._resolveFilename(pathname)
    , nuked    = module._cache[resolved]
    ;

  delete module._cache[resolved];

  return nuked;
}

function getAgentPath() {
  return path.join(__dirname, '..', '..', 'lib', 'newrelic_agent');
}

exports.loadAgent = function (options) {
  trace.resetTransactions();
  return require(getAgentPath())(options);
};

exports.loadMockedAgent = function () {
  var connection = new CollectorConnection({
    config : {
      applications : function () { return 'none'; }
    }
  });
  sinon.stub(connection, 'connect');
  return exports.loadAgent({connection : connection});
};

exports.unloadAgent = function (agent) {
  agent.stop();

  return uncacheModule(getAgentPath());
};
