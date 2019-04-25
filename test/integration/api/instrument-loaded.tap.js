'use strict'
const {test} = require('tap')
const mongodb = require('mongodb')
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')

test('ensures instrumentation with shim.require can run without an error', (t) => {
  const agent = agentHelper.instrumentMockedAgent()
  const api = new API(agent)

  api.instrumentLoadedModule('mongodb', mongodb)
  t.type(mongodb, 'function')
  t.end()
})
