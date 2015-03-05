'use strict'

var runTests = require('./pg.common.js')
var helper = require('../../lib/agent_helper')

var agent = helper.instrumentMockedAgent()
var pg = require('pg').native

runTests(agent, pg, 'native')
