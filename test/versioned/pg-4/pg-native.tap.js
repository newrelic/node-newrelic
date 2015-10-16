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
var pg = require('pg').native

runTests(agent, pg, 'native')
