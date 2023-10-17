/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Record opening times before loading any other files.
const preAgentTime = process.uptime()
const agentStart = Date.now()
const { isMainThread } = require('worker_threads')

// Load unwrapped core now to ensure it gets the freshest properties.
require('./lib/util/unwrapped-core')

const featureFlags = require('./lib/feature_flags').prerelease
const psemver = require('./lib/util/process-version')
let logger = require('./lib/logger') // Gets re-loaded after initialization.
const NAMES = require('./lib/metrics/names')
const isESMSupported = psemver.satisfies('>=16.2.0')

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

function initApi({ agent, apiPath }) {
  const API = require(apiPath)

  const api = new API(agent)
  require.cache.__NR_cache = module.exports = api
  return api
}

function initialize() {
  logger.debug('Loading agent from %s', __dirname)
  let agent = null
  let message = null

  try {
    logger.debug('Process was running %s seconds before agent was loaded.', preAgentTime)

    if (!psemver.satisfies(pkgJSON.engines.node)) {
      message =
        `New Relic for Node.js requires a version of Node ${pkgJSON.engines.node}. \n` +
        `Please upgrade from your current Node version: ${process.version}. Not starting!`

      throw new Error(message)
    }

    // TODO: Update this check when Node v22 support is added
    if (psemver.satisfies('>=21.0.0')) {
      logger.warn(
        'New Relic for Node.js %s has not been tested on Node.js %s. Please ' +
          'update the agent or downgrade your version of Node.js',
        pkgJSON.version,
        process.version
      )
    }

    logger.debug('Current working directory at module load is %s.', process.cwd())
    logger.debug('Process title is %s.', process.title)

    // execArgv happens before the script name but after the original executable name
    // https://nodejs.org/api/process.html#process_process_execargv
    const cliArgs = [process.argv[0], ...process.execArgv, ...process.argv.slice(1)]

    logger.debug('Application was invoked as %s', cliArgs.join(' '))

    const config = require('./lib/config').getOrCreateInstance()

    // Get the initialized logger as we likely have a bootstrap logger which
    // just pipes to stdout.
    logger = require('./lib/logger')

    if (!config) {
      logger.info('No configuration detected. Not starting.')
    } else if (!config.agent_enabled) {
      logger.info('Module disabled in configuration. Not starting.')
    } else if (!config.worker_threads.enabled && !isMainThread) {
      logger.warn(
        'New Relic for Node.js in worker_threads is not officially supported. Not starting! To bypass this, set `config.worker_threads.enabled` to true in configuration.'
      )
    } else {
      if (!isMainThread && config.worker_threads.enabled) {
        logger.warn(
          'Attempting to load agent in worker thread. This is not officially supported. Use at your own risk.'
        )
      }
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

  const api = agent ? initApi({ agent, apiPath: './api' }) : initApi({ apiPath: './stub_api' })

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

    if (agent.config.security.agent.enabled) {
      require('@newrelic/security-agent').start(api)
    }
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
    logger.warn('Diagnostics logging is enabled, this may cause significant overhead.')
  }

  if (appNames.length < 1) {
    const message =
      'New Relic requires that you name this application!\n' +
      'Set app_name in your newrelic.js or newrelic.cjs file or set environment variable\n' +
      'NEW_RELIC_APP_NAME. Not starting!'
    throw new Error(message)
  }

  const shimmer = require('./lib/shimmer')
  shimmer.bootstrapInstrumentation(agent)

  // Check for already loaded modules and warn about them.
  const uninstrumented = require('./lib/uninstrumented')
  uninstrumented.check(shimmer.registeredInstrumentations)
  shimmer.registerHooks(agent)

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
  recordLoaderMetric(agent)
  recordNodeVersionMetric(agent)
  recordFeatureFlagMetrics(agent)
  recordSourceMapMetric(agent)
}

/**
 * Records the major version of the Node.js runtime
 * TODO: As new versions come out, make sure to update Angler metrics.
 *
 * @param {Agent} agent active NR agent
 */
function recordNodeVersionMetric(agent) {
  const nodeMajor = /^v?(\d+)/.exec(process.version)
  const version = (nodeMajor && nodeMajor[1]) || 'unknown'
  agent.recordSupportability(`Nodejs/Version/${version}`)
}

/**
 * Records all the feature flags configured and if they are enabled/disabled
 *
 * @param {Agent} agent active NR agent
 */
function recordFeatureFlagMetrics(agent) {
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

/**
 * Used to determine how the agent is getting loaded:
 *  1. -r newrelic
 *  2. --loader newrelic/esm-loader.mjs
 *  3. require('newrelic')
 *
 *  Then a supportability metric is loaded to decide.
 *
 * @param {Agent} agent active NR agent
 */
function recordLoaderMetric(agent) {
  let isDashR = false

  process.execArgv.forEach((arg, index) => {
    if (arg === '-r' && process.execArgv[index + 1] === 'newrelic') {
      agent.metrics.getOrCreateMetric(NAMES.FEATURES.CJS.PRELOAD).incrementCallCount()
      isDashR = true
    } else if (
      (arg === '--loader' || arg === '--experimental-loader') &&
      process.execArgv[index + 1] === 'newrelic/esm-loader.mjs'
    ) {
      if (isESMSupported) {
        agent.metrics.getOrCreateMetric(NAMES.FEATURES.ESM.LOADER).incrementCallCount()
      } else {
        agent.metrics.getOrCreateMetric(NAMES.FEATURES.ESM.UNSUPPORTED_LOADER)
        logger.warn(
          'New Relic for Node.js ESM loader requires a version of Node >= v16.12.0; your version is %s.  Instrumentation will not be registered.',
          process.version
        )
      }
    }
  })

  if (!isDashR) {
    agent.metrics.getOrCreateMetric(NAMES.FEATURES.CJS.REQUIRE).incrementCallCount()
  }
}

/**
 * Checks to see if `--enable-source-maps` is being used and logs a supportability metric.
 *
 * @param {Agent} agent active NR agent
 */
function recordSourceMapMetric(agent) {
  const isSourceMapsEnabled = process.execArgv.includes('--enable-source-maps')
  if (isSourceMapsEnabled) {
    agent.metrics.getOrCreateMetric(NAMES.FEATURES.SOURCE_MAPS).incrementCallCount()
  }
}
