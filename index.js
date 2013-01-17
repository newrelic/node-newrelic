'use strict';

var path    = require('path')
  , logger  = require(path.join(__dirname, 'lib', 'logger'))
  , shimmer = require(path.join(__dirname, 'lib', 'shimmer'))
  , Agent   = require(path.join(__dirname, 'lib', 'agent'))
  ;

try {
  logger.debug("Process was running %s seconds before agent was loaded.",
               process.uptime());

  if (process.version && process.version.split('.')[1] < 6) {
    var message = "The New Relic agent requires a version of Node equal to or " +
                  "greater than 0.6.0. Not starting!";
    logger.error(message);
    console.error(message);
    return;
  }

  logger.debug("Current working directory at agent load is %s.", process.cwd());
  logger.debug("Process title is %s.", process.title);
  logger.debug("Application was invoked as %s.", process.argv.join(' '));

  var agent = new Agent();
  /*
   * Don't set up the rest of the agent if it didn't successfully load its
   * configuration.
   */
  if (agent.config) {
    /* In order to ensure all user code is using instrumented versions of
     * modules, instrumentation must be loaded at startup regardless of whether
     * or not the agent is enabled in the config. It should be possible for
     * users to switch the agent on and off at runtime.
     *
     * This also requires the agent to be a singleton, or else module loading
     * will be patched multiple times, with undefined results.
     */
    shimmer.patchModule(agent);
    shimmer.bootstrapInstrumentation(agent);

    agent.start();
  }

  module.exports = agent;
}
catch (error) {
  logger.error(error,
               "The New Relic Node.js agent was unable to start due to an error:");
  console.error("The New Relic Node.js agent was unable to start due to an error:");
  console.error(error.stack);
}
