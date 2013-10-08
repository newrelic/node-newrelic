'use strict';

var path    = require('path')
  , logger  = require(path.join(__dirname, 'lib', 'logger.js'))
  , message
  , agent
  ;

try {
  logger.debug("Process was running %s seconds before agent was loaded.",
               process.uptime());

  if (process.version && process.version.split('.')[1] < 6) {
    message = "The New Relic agent requires a version of Node equal to or\n" +
              "greater than 0.6.0. Not starting!";

    logger.error(message);
    throw new Error(message);
  }

  logger.debug("Current working directory at agent load is %s.", process.cwd());
  logger.debug("Process title is %s.", process.title);
  logger.debug("Application was invoked as %s.", process.argv.join(' '));

  /* Loading the configuration can throw if a configuration file isn't found and
   * the environment variable NEW_RELIC_NO_CONFIG_FILE isn't set.
   */
  var config = require(path.join(__dirname, 'lib', 'config.js')).initialize(logger);
  if (!config.agent_enabled) {
    logger.info("Agent not enabled in configuration; not starting.");
  }
  else {
    /* Only load the rest of the module if configuration is available and the
     * configurator didn't throw.
     *
     * The agent must be a singleton, or else module loading will be patched
     * multiple times, with undefined results. New Relic's instrumentation
     * can't be enabled or disabled without an application restart.
     */
    var Agent = require(path.join(__dirname, 'lib', 'agent.js'));
    agent = new Agent(config);

    if (agent.config.applications().length < 1) {
      message = "New Relic requires that you name this application!\n" +
                "Set app_name in your newrelic.js file or set environment variable\n" +
                "NEW_RELIC_APP_NAME. Not starting!";

      logger.error(message);
      throw new Error(message);
    }

    var shimmer = require(path.join(__dirname, 'lib', 'shimmer.js'));
    shimmer.patchModule(agent);
    shimmer.bootstrapInstrumentation(agent);

    agent.start();
  }
}
catch (error) {
  logger.error(error,
               "The New Relic Node.js agent was unable to start due to an error:");
  console.error("The New Relic Node.js agent was unable to start due to an error:");
  console.error(error.stack);
}

var API;
if (agent) {
  API = require(path.join(__dirname, 'api.js'));
}
else {
  API = require(path.join(__dirname, 'stub_api.js'));
}
module.exports = new API(agent);
