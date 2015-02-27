'use strict'

var runTests = require('./pg.common.js')
  , helper = require('../../lib/agent_helper')
  

var agent  = helper.instrumentMockedAgent()
  , pg     = require('pg').native
  

runTests(agent, pg, 'native')
