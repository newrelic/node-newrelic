'use strict'

var logger = require('./lib/logger.js')
var semver = require('semver')

var message
var agent

var agentVersion = require('./package.json').version
logger.trace("Using New Relic for Node.js version %s.", agentVersion)

if (require.cache.__NR_cache) {
  logger.warn(
    'Attempting to load a second copy of newrelic from %s, using cache instead',
    __dirname
  )
  module.exports = require.cache.__NR_cache
} else {
  initialize()
}

function initialize() {
  logger.debug(
    'Loading agent from %s',
    __dirname
  )

  try {
    logger.debug("Process was running %s seconds before agent was loaded.",
                 process.uptime())
    // Technically we run on 0.6, until we verify there are 0 users on 0.6, we
    // should leave this code doing a check against 0.6, but then advise that
    // people upgrade to one of our officially supported version (0.8 and higher)
    if (semver.satisfies(process.version, '<0.6.0')) {
      message = "New Relic for Node.js requires a version of Node equal to or\n" +
                "greater than 0.8.0. Not starting!"

      logger.error(message)
      throw new Error(message)
    }

    logger.debug("Current working directory at module load is %s.", process.cwd())
    logger.debug("Process title is %s.", process.title)
    logger.debug("Application was invoked as %s.", process.argv.join(' '))

    /* Loading the configuration can throw if a configuration file isn't found and
     * the environment variable NEW_RELIC_NO_CONFIG_FILE isn't set.
     */
    var config = require('./lib/config.js').initialize()
    if (!config.agent_enabled) {
      logger.info("Module not enabled in configuration; not starting.")
    } else {
      /* Only load the rest of the module if configuration is available and the
       * configurator didn't throw.
       *
       * The agent must be a singleton, or else module loading will be patched
       * multiple times, with undefined results. New Relic's instrumentation
       * can't be enabled or disabled without an application restart.
       */
      var Agent = require('./lib/agent.js')
      agent = new Agent(config)
      var appNames = agent.config.applications()

      if (appNames.length < 1) {
        message = "New Relic requires that you name this application!\n" +
                  "Set app_name in your newrelic.js file or set environment variable\n" +
                  "NEW_RELIC_APP_NAME. Not starting!"
        logger.error(message)
        throw new Error(message)
      }

      var shimmer = require('./lib/shimmer.js')
      shimmer.patchModule(agent)
      shimmer.bootstrapInstrumentation(agent)

      agent.start(function cb_start(error) {
        if (!error) {
          return logger.debug("New Relic for Node.js is connected to New Relic.")
        }

        var errorMessage = "New Relic for Node.js halted startup due to an error:"
        logger.error(error, errorMessage)

        console.error(errorMessage)
        console.error(error.stack)
      })
    }
  } catch (error) {
    message = "New Relic for Node.js was unable to bootstrap itself due to an error:"
    logger.error(error, message)

    console.error(message)
    console.error(error.stack)
  }

  var API
  if (agent) {
    API = require('./api.js')
  } else {
    API = require('./stub_api.js')
  }

  require.cache.__NR_cache = module.exports = new API(agent)
}
