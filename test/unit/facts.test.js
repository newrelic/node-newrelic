'use strict'

var path     = require('path')
  , hostname = require('os').hostname
  , chai     = require('chai')
  , expect   = chai.expect
  , should   = chai.should()
  , helper   = require('../lib/agent_helper.js')
  , facts    = require('../../lib/collector/facts.js')
  

var EXPECTED = ['pid', 'host', 'language', 'app_name',
                'agent_version', 'environment', 'settings', 'high_security']

describe("fun facts about apps that New Relic is interested in include", function () {
  var agent
    , factsed
    

  before(function () {
    agent = helper.loadMockedAgent()
    factsed = facts(agent)
  })

  after(function () {
    helper.unloadAgent(agent)
  })

  it("the current process ID as 'pid'", function () {
    expect(factsed.pid).equal(process.pid)
  })

  it("the current hostname as 'host' (hope it's not 'localhost' lol)", function () {
    expect(factsed.host).equal(hostname())
    expect(factsed.host).not.equal('localhost')
    expect(factsed.host).not.equal('localhost.local')
    expect(factsed.host).not.equal('localhost.localdomain')
  })

  it("the agent's language (as 'language') to be 'nodejs'", function () {
    expect(factsed.language).equal('nodejs')
  })

  it("an array of one or more application names as 'app_name' (sic)", function () {
    expect(factsed.app_name).an('array')
    expect(factsed.app_name).length.above(0)
  })

  it("the module's version as 'agent_version'", function () {
    expect(factsed.agent_version).equal(agent.version)
  })

  it("the environment (see environment.test.js) as crazy nested arrays", function () {
    should.exist(factsed.environment)

    var materialized = factsed.environment.toJSON()
    expect(materialized).an('array')
    expect(materialized).length.above(1)
  })

  it("and nothing else", function () {
    expect(Object.keys(factsed).sort()).eql(EXPECTED.sort())
  })
})
