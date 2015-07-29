'use strict'

var runTests = require('./pg.common.js')
var helper = require('../../lib/agent_helper')

// We cant test v0.8 here because pg-native 4 uses stream.Duplex, which doesn't exist
// in v0.8
var semver = require('semver')
if (semver.satisfies(process.versions.node, '0.8.x')) return

var agent = helper.instrumentMockedAgent()
var pg = require('pg').native

runTests(agent, pg, 'native')
