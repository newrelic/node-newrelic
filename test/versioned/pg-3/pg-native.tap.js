'use strict'

var runTests = require('./pg.common.js')
var helper = require('../../lib/agent_helper')

// We only run this for 0.10 because 0.8 doesn't build pg-3 native, and 0.12+ has strange
// issues with TAP. Once a new test harness is used, 0.12+ should be included in this
// test.
var semver = require('semver')
if (!semver.satisfies(process.versions.node, '0.10.x')) return

var agent = helper.instrumentMockedAgent()
var pg = require('pg').native

runTests(agent, pg, 'native')
