'use strict'

const tap = require('tap')
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')

tap.test('Agent API - instrumentLoadedModule', (t) => {
  t.autoend()

  let agent
  let api
  let expressMock
  let shimHelper

  t.beforeEach((done) => {
    agent = agentHelper.instrumentMockedAgent()

    api = new API(agent)

    expressMock = {}
    expressMock.application = {}
    expressMock.application.use = function use() {
    }
    expressMock.Router = {}

    shimHelper = new Shim(agent, 'fake')

    done()
  })

  t.afterEach((done) => {
    agentHelper.unloadAgent(agent)
    agent = null
    api = null
    expressMock = null

    done()
  })

  t.test('should be callable without an error', (t) => {
    api.instrumentLoadedModule('express', expressMock)

    t.end()
  })

  t.test('should return true when a function is instrumented', (t) => {
    const didInstrument = api.instrumentLoadedModule('express', expressMock)
    t.equal(didInstrument, true)

    t.end()
  })

  t.test('should wrap express.application.use', (t) => {
    api.instrumentLoadedModule('express', expressMock)

    t.type(expressMock, 'object')

    const isWrapped = shimHelper.isWrapped(expressMock.application.use)
    t.ok(isWrapped)

    t.end()
  })
})
