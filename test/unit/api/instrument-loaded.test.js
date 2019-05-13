'use strict'
const chai = require('chai')
const expect = chai.expect
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')

describe('API.instrumentLoadedModule', function() {
  var agent
  var api
  var expressMock
  var shimHelper

  beforeEach(function() {
    agent = agentHelper.instrumentMockedAgent()

    api = new API(agent)

    expressMock = {}
    expressMock.application = {}
    expressMock.application.use = function use() {
    }
    expressMock.Router = {}

    shimHelper = new Shim(agent, 'fake')
  })

  afterEach(function() {
    agentHelper.unloadAgent(agent)
    agent = null
    api = null
    expressMock = null
  })

  it('should be callable without an error', function() {
    api.instrumentLoadedModule('express', expressMock)
  })

  it('should return true when a function is instrumented', function() {
    expect(api.instrumentLoadedModule('express', expressMock)).equal(true)
  })

  it('should wrap express.application.use', function() {
    api.instrumentLoadedModule('express', expressMock)

    expect(expressMock).is.an('object')
    expect(shimHelper.isWrapped(expressMock.application.use)).equal(true)
  })
})
