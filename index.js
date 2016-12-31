'use strict'

var BETA_MESSAGE =
  '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n' +
  'This is a beta version of the New Relic agent and requires a valid beta\n' +
  'token. If you would like to participate in the beta, please contact New\n' +
  'Relic support. If you have received a beta token, make sure you have set\n' +
  '`beta_token` in your newrelic.js file or set the environment variable\n' +
  'NEW_RELIC_BETA_TOKEN.\n' +
  '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'

var logger = require('./lib/logger.js')
var semver = require('semver')
var crypto = require('crypto')

var message
var agent

var agentVersion = require('./package.json').version
logger.info(
  "Using New Relic for Node.js. Agent version: %s; Node version: %s.",
  agentVersion, process.version
)

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

  // Always warn that we're in a beta.
  logger.warn(BETA_MESSAGE)

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
    } else if (!_checkBetaToken(config.beta_token)) {
      // The beta token is invalid. Make sure the user knows what's going on by
      // sending them a large verbose message.
      logger.info('Beta token is invalid; not starting.')
      throw new Error(BETA_MESSAGE)
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

      if (config.logging.diagnostics) {
        logger.warn(
          'Diagnostics logging is enabled, this may cause significant overhead.'
        )
      }

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

        /* eslint-disable no-console */
        console.error(errorMessage)
        console.error(error.stack)
        /* eslint-enable no-console */
      })
    }
  } catch (error) {
    message = "New Relic for Node.js was unable to bootstrap itself due to an error:"
    logger.error(error, message)

    /* eslint-disable no-console */
    console.error(message)
    console.error(error.stack)
    /* eslint-enable no-console */
  }

  var API
  if (agent) {
    API = require('./api.js')
  } else {
    API = require('./stub_api.js')
  }

  require.cache.__NR_cache = module.exports = new API(agent)
}

function _checkBetaToken(betaToken) {
  var hashCheck = new Buffer([
    143, 233, 86, 59, 122, 214, 233, 135, 2, 173,
    214, 141, 80, 195, 57, 198, 142, 193, 154, 148,
    55, 92, 195, 114, 169, 253, 172, 40, 13, 110,
    220, 209, 68, 39, 163, 73, 81, 83, 156, 84,
    94, 121, 144, 147, 101, 47, 147, 49, 73, 40,
    92, 81, 226, 224, 237, 1, 87, 238, 44, 27,
    87, 145, 234, 223
  ])

  var hasher = crypto.createHash('sha512')
  hasher.update(betaToken || '')
  return hashCheck.toString('base64') === hasher.digest().toString('base64')
}
