/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const a = require('async')
const fetchSystemInfo = require('../system-info')
const logger = require('../logger').child({component: 'facts'})
const os = require('os')
const parse_labels = require('../util/label-parser')
const Config = require('../config/')

module.exports = facts

function facts(agent, callback) {
  var startTime = Date.now()
  a.parallel({
    systemInfo: a.apply(fetchSystemInfo, agent),
    environment: agent.environment.getJSON
  }, function factMapCb(err, data) {
    logger.trace('Facts gathering finished in %dms', Date.now() - startTime)

    if (err) {
      logger.debug(err, 'Failed to load system facts!')
    }
    data = data || Object.create(null)
    const systemInfo = data.systemInfo || Object.create(null)
    const environment = data.environment || []

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
      labels: parse_labels(agent.config.labels),
      metadata: Object.keys(process.env).reduce((obj, key) => {
        if (key.startsWith('NEW_RELIC_METADATA_')) {
          obj[key] = process.env[key]
        }
        return obj
      }, {})
    }

    logger.debug('New Relic metadata %o', results.metadata)

    results.event_harvest_config = {
      harvest_limits: {
        analytic_event_data: agent.config.transaction_events.max_samples_stored,
        custom_event_data: agent.config.custom_insights_events.max_samples_stored,
        error_event_data: agent.config.error_collector.max_event_samples_stored,
        span_event_data: Config.SPAN_EVENT_LIMIT
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

    return callback(results)
  })
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
 */
function getIdentifierOverride(appNames) {
  const identifier = [
    'nodejs',
    // NOTE: The concat is necessary to prevent sort from happening in-place.
    appNames.concat([]).sort().join(',')
  ].join(':')

  return identifier
}
