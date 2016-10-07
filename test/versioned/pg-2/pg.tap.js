'use strict'

var runTests = require('./pg.common.js')
var helper = require('../../lib/agent_helper')


var agent = helper.instrumentMockedAgent(null, {
  transaction_tracer: {
    record_sql: 'raw'
  },
  slow_sql: {
    enabled: true
  }
})
var pg     = require('pg')

runTests(agent, pg, 'pure JavaScript')
