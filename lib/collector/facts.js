'use strict';

var os = require('os');

module.exports = function facts(agent) {
  var bm = agent.config.browser_monitoring;
  var tt = agent.config.transaction_tracer;
  return {
    pid           : process.pid,
    host          : os.hostname(),
    language      : 'nodejs',
    app_name      : agent.config.applications(),
    agent_version : agent.version,
    environment   : agent.environment,
    settings      : agent.config.publicSettings(),

    // required by high-security mode
    security_settings : {
      capture_params     : agent.config.capture_params,
      transaction_tracer : {
        record_sql : tt.record_sql
      }
    }
  };
};
