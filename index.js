'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, 'lib', 'shimmer'))
  , Agent   = require(path.join(__dirname, 'lib', 'agent'))
  ;

var agent = new Agent();

// set up all of the instrumentation
shimmer.wrapAgent(agent);
shimmer.patchModule(agent);
shimmer.bootstrapInstrumentation(agent);

agent.start();

module.exports = agent;
