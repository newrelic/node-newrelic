'use strict'

var os = require('os')

module.exports = function facts(agent) {
  return {
    pid           : process.pid,
    host          : os.hostname(),
    language      : 'nodejs',
    app_name      : agent.config.applications(),
    agent_version : agent.version,
    environment   : agent.environment,
    settings      : agent.config.publicSettings(),
    high_security : agent.config.high_security
  }
}
