'use strict';

var runTests = require('./instrumentation-pg.common.js')
  , helper = require('../lib/agent_helper')
  ;

var agent  = helper.instrumentMockedAgent()
  , pg     = require('pg')
  ;

runTests(agent, pg, 'pure JavaScript');
