'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, 'shimmer'))
  , Agent   = require(path.join(__dirname, 'agent'))
  ;

var agent;
var invocationOptions;

module.exports = function (options) {
  if (!options && !invocationOptions && agent) return agent;

  invocationOptions = options;

  agent = new Agent(options);

  // set up all of the instrumentation
  shimmer.wrapAgent(agent);
  shimmer.patchModule(agent);
  shimmer.bootstrapInstrumentation(agent);

  agent.start();

  return agent;
};
