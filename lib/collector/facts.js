'use strict'

var fetchSystemInfo = require('../system-info')
var parse_labels = require('../util/label-parser')

module.exports = facts

function facts(agent, callback) {
  fetchSystemInfo(agent, function cb_fetchSystemInfo(systemInfo) {
    var hostname = agent.config.getHostnameSafe()
    callback({
      utilization: {
        metadata_version: 1,
        logical_processors: systemInfo.logicalProcessors,
        total_ram_mib: systemInfo.memory,
        hostname: hostname,
        vendors: {
          aws: systemInfo.aws,
          docker: systemInfo.docker
        }
      },
      pid: process.pid,
      host: hostname,
      display_host: agent.config.getDisplayHost() || hostname,
      language: 'nodejs',
      app_name: agent.config.applications(),
      agent_version: agent.version,
      environment: agent.environment,
      settings: agent.config.publicSettings(),
      high_security: agent.config.high_security,
      labels: parse_labels(agent.config.labels)
    })
  })
}
