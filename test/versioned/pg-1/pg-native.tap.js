'use strict'

var runTests = require('./pg.common.js')
var helper = require('../../lib/agent_helper')

// PG-1 Does not build on newer versions of node, so skip this test.
var semver = require('semver')
if (semver.satisfies(process.versions.node, '>=0.11.0')) {
  return
}

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
