'use strict'

var path = require('path')
var hostname = require('os').hostname
var chai = require('chai')
var expect = chai.expect
var should = chai.should()
var helper = require('../lib/agent_helper.js')
var facts = require('../../lib/collector/facts.js')


var EXPECTED = ['pid', 'host', 'language', 'app_name', 'labels', 'utilization',
                'agent_version', 'environment', 'settings', 'high_security']

describe("fun facts about apps that New Relic is interested in include", function () {
  var agent

  before(function () {
    agent = helper.loadMockedAgent()
    agent.config.utilization = {
      detect_aws: false,
      detect_docker: false
    }
  })

  after(function () {
    helper.unloadAgent(agent)
  })

  it("the current process ID as 'pid'", function (done) {
    facts(agent, function getFacts(factsed) {
      expect(factsed.pid).equal(process.pid)
      done()
    })
  })

  it("the current hostname as 'host' (hope it's not 'localhost' lol)", function (done) {
    facts(agent, function getFacts(factsed) {
      expect(factsed.host).equal(hostname())
      expect(factsed.host).not.equal('localhost')
      expect(factsed.host).not.equal('localhost.local')
      expect(factsed.host).not.equal('localhost.localdomain')
      done()
    })
  })

  it("the agent's language (as 'language') to be 'nodejs'", function (done) {
    facts(agent, function getFacts(factsed) {
      expect(factsed.language).equal('nodejs')
      done()
    })
  })

  it("an array of one or more application names as 'app_name' (sic)", function (done) {
    facts(agent, function getFacts(factsed) {
      expect(factsed.app_name).an('array')
      expect(factsed.app_name).length.above(0)
      done()
    })
  })

  it("the module's version as 'agent_version'", function (done) {
    facts(agent, function getFacts(factsed) {
      expect(factsed.agent_version).equal(agent.version)
      done()
    })
  })

  it("the environment (see environment.test.js) as crazy nested arrays", function (done) {
    facts(agent, function getFacts(factsed) {
      should.exist(factsed.environment)

      var materialized = factsed.environment.toJSON()
      expect(materialized).an('array')
      expect(materialized).length.above(1)
      done()
    })
  })

  it("and nothing else", function (done) {
    facts(agent, function getFacts(factsed) {
      expect(Object.keys(factsed).sort()).eql(EXPECTED.sort())
        done()
    })
  })

  it('should convert label object to expected format', function(done) {
    var long_key = Array(257).join('€')
    var long_value = Array(257).join('𝌆')
    agent.config.labels = {}
    agent.config.labels.a = 'b'
    agent.config.labels[long_key] = long_value
    facts(agent, function getFacts(factsed) {
      var expected = [{label_type: 'a', label_value: 'b'}]
      expected.push({label_type: Array(256).join('€'), label_value: Array(256).join('𝌆')})

      expect(factsed.labels).deep.equal(expected)
      done()
    })
  })

  it('should convert label string to expected format', function(done) {
    var long_key = Array(257).join('€')
    var long_value = Array(257).join('𝌆')
    agent.config.labels = 'a: b; ' + long_key + ' : ' + long_value
    facts(agent, function getFacts(factsed) {
      var expected = [{label_type: 'a', label_value: 'b'}]
      expected.push({label_type: Array(256).join('€'), label_value: Array(256).join('𝌆')})

      expect(factsed.labels).deep.equal(expected)
      done()
    })
  })
})
