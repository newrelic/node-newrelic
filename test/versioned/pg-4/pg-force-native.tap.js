'use strict'
// We cant test v0.8 here because pg-native 4 uses stream.Duplex, which doesn't exist
// in v0.8
// The native component currently can not build on >= v3, so we skip
// this test for now
var semver = require('semver')
if (semver.satisfies(process.versions.node, '0.8.x||>=3')) return

var runTests = require('./pg.common.js')
var helper = require('../../lib/agent_helper')

var agent = helper.instrumentMockedAgent()

// setting env var for forcing native
process.env.NODE_PG_FORCE_NATIVE = true

var pg = require('pg')

delete process.env.NODE_PG_FORCE_NATIVE

runTests(agent, pg, 'forced native')
