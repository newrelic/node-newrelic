'use strict'

var runTests = require('./pg.common.js')
var helper = require('../../lib/agent_helper')

var semver = require('semver')
if (semver.satisfies(process.versions.node, '>=0.11.0')) return

var agent = helper.instrumentMockedAgent(null, {
  transaction_tracer: {
    record_sql: 'raw'
  },
  slow_sql: {
    enabled: true
  }
})
var pg = require('pg').native

runTests(agent, pg, 'native')
