'use strict'

var a = require('async')
var fetchSystemInfo = require('../system-info')
var logger = require('../logger').child({component: 'facts'})
var parse_labels = require('../util/label-parser')


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
    var systemInfo = data.systemInfo || Object.create(null)
    var environment = data.environment || []

    var hostname = agent.config.getHostnameSafe()
    var results = {
      utilization: {
        metadata_version: 3,
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
      labels: parse_labels(agent.config.labels)
    }

    // TODO:  After reconfiguring agent startup to wait for the server to start
    //        or for the first transaction, add the `port` for the server too.
    // NOTE: The concat is necessary to prevent sort from happening in-place.
    results.identifier = [
      'nodejs',
      results.host,
      results.app_name.concat([]).sort().join(',')
    ].join(':')

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
