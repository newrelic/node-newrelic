'use strict'

const tap = require('tap')
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')

tap.test('API.instrumentLoadedModule', function(t) {
  let agent
  let api
  let expressMock
  let shimHelper

  t.beforeEach(function(done) {
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

  t.afterEach(function(done) {
    agentHelper.unloadAgent(agent)
    agent = null
    api = null
    expressMock = null
    done()
  })

  t.test('should be callable without an error', function(t) {
    t.ok(api.instrumentLoadedModule('express', expressMock))
    t.end()
  })

  t.test('should return true when a function is instrumented', function(t) {
    t.ok(api.instrumentLoadedModule('express', expressMock))
    t.end()
  })

  t.test('should wrap express.application.use', function(t) {
    api.instrumentLoadedModule('express', expressMock)

    t.ok((typeof expressMock) === 'object')
    t.ok(shimHelper.isWrapped(expressMock.application.use))
    t.end()
  })

  t.test('should not throw if supported module is not installed', function(t) {
    // we need a supported module in our test
    let awsSdk = false
    try {
      awsSdk = require('aws-sdk')
    } catch (e) {
    }
    t.ok(awsSdk === false, 'aws-sdk is not installed')

    // attempt to instrument -- if nothing throws we're good
    try {
      api.instrumentLoadedModule('aws-sdk', awsSdk)
    } catch (e) {
      t.error(e)
    }
    t.end()
  })

  t.autoend()
})
