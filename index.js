'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, 'lib', 'shimmer'))
  , Agent   = require(path.join(__dirname, 'lib', 'agent'))
  ;

var agent = new Agent();

if (process.version && process.version.split('.')[1] < 6) {
  return console.error('New Relic requires a version of Node equal to or greater than 0.6');
}

/**
 * Don't set up the rest of the agent if it didn't successfully load its
 * configuration.
 */
if (agent.config) {
  // set up all of the instrumentation
  shimmer.patchModule(agent);
  shimmer.bootstrapInstrumentation(agent);

  agent.start();
}

module.exports = agent;
