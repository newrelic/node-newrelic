'use strict'

const a = require('async')
const fetchSystemInfo = require('../system-info')
const logger = require('../logger').child({component: 'facts'})
const os = require('os')
const parse_labels = require('../util/label-parser')


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

    // TODO:  After reconfiguring agent startup to wait for the server to start
    //        or for the first transaction, add the `port` for the server too.
    // NOTE: The concat is necessary to prevent sort from happening in-place.
    results.identifier = [
      'nodejs',
      results.host,
      results.app_name.concat([]).sort().join(',')
    ].join(':')

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
      Array.prototype.push.apply(addresses, interfaceAddresses)
    }
    return addresses
  }, [])
}
