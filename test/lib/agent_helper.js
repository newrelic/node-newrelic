'use strict';

var path                = require('path')
  , sinon               = require('sinon')
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

  loadMockedAgent : function loadMockedAgent() {
    var connection = new CollectorConnection({
      config : {
        applications : function () { return 'none'; }
      }
    });
    sinon.stub(connection, 'connect');
    return helper.loadAgent({connection : connection});
  }
};
