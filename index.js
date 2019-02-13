'use strict'

// Record opening times before loading any other files.
const preAgentTime = process.uptime()
const agentStart = Date.now()

// Load unwrapped core now to ensure it gets the freshest properties.
require('./lib/util/unwrapped-core')

const featureFlags = require('./lib/feature_flags').prerelease
const psemver = require('./lib/util/process-version')
let logger = require('./lib/logger') // Gets re-loaded after initialization.


const pkgJSON = require('./package.json')
logger.info(
  'Using New Relic for Node.js. Agent version: %s; Node version: %s.',
  pkgJSON.version,
  process.version
)

if (require.cache.__NR_cache) {
  logger.warn(
    'Attempting to load a second copy of newrelic from %s, using cache instead',
    __dirname
  )
  if (require.cache.__NR_cache.agent) {
    require.cache.__NR_cache.agent.recordSupportability('Agent/DoubleLoad')
  }
  module.exports = require.cache.__NR_cache
} else {
  initialize()
}

function initialize() {
  logger.debug('Loading agent from %s', __dirname)
  let agent = null
  let message = null

  try {
    logger.debug(
      'Process was running %s seconds before agent was loaded.',
      preAgentTime
    )

    // TODO: Update this check when Node v6 is deprecated.
    if (psemver.satisfies('<6.0.0')) {
      message = 'New Relic for Node.js requires a version of Node equal to or\n' +
                'greater than 6.0.0. Not starting!'

      logger.error(message)
      throw new Error(message)
    } else if (!psemver.satisfies(pkgJSON.engines.node)) {
      logger.warn(
        'New Relic for Node.js %s has not been tested on Node.js %s. Please ' +
        'update the agent or downgrade your version of Node.js',
        pkgJSON.version,
        process.version
      )
    }

    logger.debug('Current working directory at module load is %s.', process.cwd())
    logger.debug('Process title is %s.', process.title)
    logger.debug('Application was invoked as %s.', process.argv.join(' '))

    const config = require('./lib/config').getOrCreateInstance()

    // Get the initialized logger as we likely have a bootstrap logger which
    // just pipes to stdout.
    logger = require('./lib/logger')

    if (!config || !config.agent_enabled) {
      logger.info('Module not enabled in configuration; not starting.')
    } else {
      agent = createAgent(config)
      addStartupSupportabilities(agent)
    }
  } catch (error) {
    message = 'New Relic for Node.js was unable to bootstrap itself due to an error:'
    logger.error(error, message)

    /* eslint-disable no-console */
    console.error(message)
    console.error(error.stack)
    /* eslint-enable no-console */
  }

  let API = null
  if (agent) {
    API = require('./api')
  } else {
    API = require('./stub_api')
  }

  require.cache.__NR_cache = module.exports = new API(agent)

  // If we loaded an agent, record a startup time for the agent.
  // NOTE: Metrics are recorded in seconds, so divide the value by 1000.
  if (agent) {
    const initDuration = (Date.now() - agentStart) / 1000
    agent.recordSupportability('Nodejs/Application/Opening/Duration', preAgentTime)
    agent.recordSupportability('Nodejs/Application/Initialization/Duration', initDuration)
    agent.once('started', function timeAgentStart() {
      agent.recordSupportability(
        'Nodejs/Application/Registration/Duration',
        (Date.now() - agentStart) / 1000
      )
    })
  }
}

function createAgent(config) {
  /* Only load the rest of the module if configuration is available and the
   * configurator didn't throw.
   *
   * The agent must be a singleton, or else module loading will be patched
   * multiple times, with undefined results. New Relic's instrumentation
   * can't be enabled or disabled without an application restart.
   */
  const Agent = require('./lib/agent')
  const agent = new Agent(config)
  const appNames = agent.config.applications()

  if (config.logging.diagnostics) {
    logger.warn(
      'Diagnostics logging is enabled, this may cause significant overhead.'
    )
  }

  if (appNames.length < 1) {
    const message =
      'New Relic requires that you name this application!\n' +
      'Set app_name in your newrelic.js file or set environment variable\n' +
      'NEW_RELIC_APP_NAME. Not starting!'
    logger.error(message)
    throw new Error(message)
  }

  const shimmer = require('./lib/shimmer')
  shimmer.patchModule(agent)
  shimmer.bootstrapInstrumentation(agent)

  // Check for already loaded modules and warn about them.
  const uninstrumented = require('./lib/uninstrumented')
  uninstrumented.check(shimmer.registeredInstrumentations)

  agent.start(function afterStart(error) {
    if (error) {
      const errorMessage = 'New Relic for Node.js halted startup due to an error:'
      logger.error(error, errorMessage)

      /* eslint-disable no-console */
      console.error(errorMessage)
      console.error(error.stack)
      /* eslint-enable no-console */

      return
    }

    logger.debug('New Relic for Node.js is connected to New Relic.')
  })

  return agent
}

function addStartupSupportabilities(agent) {
  // TODO: As new versions come out, make sure to update Angler metrics.
  const nodeMajor = /^v?(\d+)/.exec(process.version)
  agent.recordSupportability(
    'Nodejs/Version/' + ((nodeMajor && nodeMajor[1]) || 'unknown')
  )

  const configFlags = Object.keys(agent.config.feature_flag)
  for (let i = 0; i < configFlags.length; ++i) {
    const flag = configFlags[i]
    const enabled = agent.config.feature_flag[flag]

    if (enabled !== featureFlags[flag]) {
      agent.recordSupportability(
        'Nodejs/FeatureFlag/' + flag + '/' + (enabled ? 'enabled' : 'disabled')
      )
    }
  }
}
