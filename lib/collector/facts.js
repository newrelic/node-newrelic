/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fetchSystemInfo = require('../system-info')
const logger = require('../logger').child({ component: 'facts' })
const os = require('os')
const parseLabels = require('../util/label-parser')
const NAMES = require('../metrics/names')

// For now static and tentative list of which logging libraries we
// want to track. Later might come up with a better way of populating
// this list.
const LOG_LIBRARIES = ['winston', 'bunyan', 'pino', 'loglevel', 'npmlog', 'fancy-log']

module.exports = facts

async function facts(agent, callback) {
  const startTime = Date.now()

  const systemInfoPromise = new Promise((resolve) => {
    fetchSystemInfo(agent, (_, data) => {
      resolve(data)
    })
  })

  const environmentPromise = agent.environment.getJSON()
  let [systemInfo, environment] = await Promise.all([systemInfoPromise, environmentPromise])
  logger.trace('Facts gathering finished in %dms', Date.now() - startTime)

  if (environment.failed) {
    logger.debug(environment.err, 'Failed to load system facts!')
  }

  systemInfo = systemInfo || Object.create(null)
  environment = environment || []

  countSupportabilityForLogLibraries(environment, agent)

  const hostname = agent.config.getHostnameSafe()
  const results = {
    utilization: {
      metadata_version: 5,
      logical_processors: systemInfo.logicalProcessors || null,
      total_ram_mib: systemInfo.memory || null,
      hostname: hostname
    },
    pid: process.pid,
    host: hostname,
    display_host: agent.config.getDisplayHost() || hostname,
    language: 'nodejs',
    app_name: agent.config.applications(),
    agent_version: agent.version,
    environment: environment,
    settings: agent.config.publicSettings(),
    high_security: agent.config.high_security,
    labels: parseLabels(agent.config.labels),
    metadata: Object.keys(process.env).reduce((obj, key) => {
      if (key.startsWith('NEW_RELIC_METADATA_')) {
        obj[key] = process.env[key]
      }
      return obj
    }, {})
  }

  logger.debug('New Relic metadata %o', results.metadata)

  /**
   * WARNING: This may not make sense if you are familiar with our config
   * and updating of config from server.  But the intention here is to always
   * send the values from user config of harvest limits because on connect these
   * values get reconfigured based on harvest cycle intervals.  So if you originally
   * had 1000 and a harvest of 5 seconds the new value of the harvest limit would be 83.
   * Then every subsequent connect request it would continue to decrease until it eventually hit 0
   * and we would never be sampling a certain piece of data.
   */
  results.event_harvest_config = {
    harvest_limits: {
      analytic_event_data: agent.config.transaction_events.max_samples_stored,
      custom_event_data: agent.config.custom_insights_events.max_samples_stored,
      error_event_data: agent.config.error_collector.max_event_samples_stored,
      span_event_data: agent.config.span_events.max_samples_stored,
      log_event_data: agent.config.application_logging.forwarding.max_samples_stored
    }
  }

  results.identifier = getIdentifierOverride(results.app_name)

  const ipAddresses = getAllIPAddresses()
  if (ipAddresses.length) {
    results.utilization.ip_address = ipAddresses
  }

  if (systemInfo.bootId) {
    results.utilization.boot_id = systemInfo.bootId
  }

  if (systemInfo.vendors) {
    results.utilization.vendors = systemInfo.vendors
  }

  if (systemInfo.config) {
    results.utilization.config = systemInfo.config
  }

  callback(results)
}

function getAllIPAddresses() {
  const interfaces = os.networkInterfaces()
  const localRegex = /^lo/
  return Object.keys(interfaces).reduce(function gatherAddresses(addresses, key) {
    if (!localRegex.test(key)) {
      const interfaceAddresses = interfaces[key].map(function getAddress(inter) {
        return inter.address
      })

      for (let index = 0; index < interfaceAddresses.length; index++) {
        const address = interfaceAddresses[index]
        addresses.push(address)
      }
    }

    return addresses
  }, [])
}

/**
 * Creates an identifier override to support customers who have multiple agents on the
 * same host with the first app name that is identical.
 * https://github.com/newrelic/node-newrelic/commit/c0901e6807a50ac3969d79ab48c31c8e0232a6b5#r18254962
 * https://source.datanerd.us/collector-collective/connect-service/blob/1470c21109393a5b43c8788da88a37f41a300b98/src/main/java/com/nr/collector/methods/Connect.java#L1424-L1431
 *
 * IMPORTANT: we do not include host as it has negative consequences and is unnecessary.
 * On the server, the host will still be used as part of the key to determine if two agent
 * connections are the same real agent or a separate one.
 * https://github.com/newrelic/node-newrelic/issues/654
 *
 * @param appNames
 */
function getIdentifierOverride(appNames) {
  const identifier = [
    'nodejs',
    // NOTE: The concat is necessary to prevent sort from happening in-place.
    appNames.concat([]).sort().join(',')
  ].join(':')

  return identifier
}

/**
 * This function searches the computed environment for the presence of
 * some popular logging libraries. If present, it increments the
 * corresponding supportability metrics.
 *
 * @param {Array} environment the environment computed by
 * @param {object} agent the New Relic agent
 */
function countSupportabilityForLogLibraries(environment, agent) {
  const packages = environment.find((elt) => elt[0] === 'Packages')[1]
  packages.forEach((pkg) => {
    pkg = JSON.parse(pkg)[0]
    if (LOG_LIBRARIES.includes(pkg)) {
      agent.metrics
        .getOrCreateMetric(`${NAMES.SUPPORTABILITY.NODEJS_DEPENDENCIES}/${pkg}`)
        .incrementCallCount()
    }
  })
}
