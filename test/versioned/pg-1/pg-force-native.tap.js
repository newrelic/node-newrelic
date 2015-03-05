'use strict'

var runTests = require('./pg.common.js')
var helper = require('../../lib/agent_helper')
var semver = require('semver')
if (semver.satisfies(process.versions.node, '>=0.11.0')) return

var agent = helper.instrumentMockedAgent()

// setting env var for forcing native
process.env.NODE_PG_FORCE_NATIVE = true

var pg = require('pg')

delete process.env.NODE_PG_FORCE_NATIVE


runTests(agent, pg, 'forced native')
