'use strict'

var path         = require('path')
  , test         = require('tap').test
  , configurator = require('../../../lib/config')
  , Agent        = require('../../../lib/agent')
  

test("Collector API should connect to staging-collector.newrelic.com", function (t) {
  var config = configurator.initialize({
        'app_name'    : 'node.js Tests',
        'license_key' : 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
        'host'        : 'staging-collector.newrelic.com',
        'port'        : 443,
        'ssl'         : true,
        'logging'     : {
          'level' : 'trace'
        }
      })
    , agent = new Agent(config)
    

  agent.start(function cb_start(error, returned) {
    t.notOk(error, "connected without error")
    t.ok(returned, "got boot configuration")
    t.ok(returned.agent_run_id, "got run ID")
    t.ok(agent.config.run_id, "run ID set in configuration")

    agent.stop(function cb_stop(error) {
      t.notOk(error, "should have shut down without issue")
      t.notOk(agent.config.run_id, "run ID should have been cleared by shutdown")

      t.end()
    })
  })
})
