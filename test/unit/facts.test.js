'use strict'

var hostname = require('os').hostname
var chai = require('chai')
var expect = chai.expect
var should = chai.should()
var helper = require('../lib/agent_helper.js')
var facts = require('../../lib/collector/facts.js')


var EXPECTED = ['pid', 'host', 'language', 'app_name', 'labels', 'utilization',
                'agent_version', 'environment', 'settings', 'high_security',
                'display_host']

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

describe('display_host', function () {
  var os = require('os')
  var agent
  var original_hostname = os.hostname

  beforeEach(function () {
    agent = helper.loadMockedAgent()
    agent.config.utilization = {
      detect_aws: false,
      detect_docker: false
    }
    os.hostname = function() {
      throw ('BROKEN')
    }
  })

  afterEach(function () {
    os.hostname = original_hostname
    helper.unloadAgent(agent)
  })
  it('should be set to what the user specifies (happy path)', function (done) {
    agent.config.process_host.display_name = 'test-value'
    facts(agent, function getFacts(factsed) {
      expect(factsed.display_host).equal('test-value')
      done()
    })
  })
  it("should be cached along with hostname in config", function (done) {
    agent.config.process_host.display_name = 'test-value'
    facts(agent, function getFacts(factsed) {
      var displayHost1 = factsed.display_host
      var host1 = factsed.host

      os.hostname = original_hostname
      agent.config.process_host.display_name = 'test-value2'

      facts(agent, function getFacts2(factsed2) {
        expect(factsed2.display_host).deep.equal(displayHost1)
        expect(factsed2.host).deep.equal(host1)

        agent.config.clearHostnameCache()
        agent.config.clearDisplayHostCache()

        facts(agent, function getFacts3(factsed3) {
          expect(factsed3.display_host).deep.equal('test-value2')
          expect(factsed3.host).deep.equal(os.hostname())
          done()
        })
      })
    })
  })
  it('should be set as os.hostname() (if available) when not specified', function(done) {
    os.hostname = original_hostname
    facts(agent, function getFacts(factsed) {
      expect(factsed.display_host).equal(os.hostname())
      done()
    })
  })
  it("should be ipv4 when ipv_preference === '4' and os.hostname() not available",
    function(done) {
      agent.config.process_host.ipv_preference = '4'
      var ipv4Pattern = /((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])/

      facts(agent, function getFacts(factsed) {
        expect(factsed.display_host).match(ipv4Pattern)
        done()
      })
    })
  it("should be ipv6 when ipv_preference === '6' and os.hostname() not available",
    function(done) {
      agent.config.process_host.ipv_preference = '6'
      var ipv6Pattern = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/

      facts(agent, function getFacts(factsed) {
        expect(factsed.display_host).match(ipv6Pattern)
        done()
      })
    })
  it("should be ipv4 when invalid ipv_preference and os.hostname() not available",
    function badIpPref(done) {
      agent.config.process_host.ipv_preference = '9'
      var ipv4Pattern = /((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])/

      facts(agent, function getFacts(factsed) {
        expect(factsed.display_host).match(ipv4Pattern)
        done()
      })
  })
  describe("When os.networkInterfaces()", function netInterface() {
    it("returns no ipv4, hostname should be ipv6 if possible",
      function noip4(done) {
        var mockedNI = {lo: [], en0: [{
            address: 'fe80::a00:27ff:fe4e:66a1',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: '01:02:03:0a:0b:0c',
            internal: false
          }]
        }
        var original_NI = os.networkInterfaces
        os.networkInterfaces = createMock(mockedNI)
        var ipv6Pattern = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/

        facts(agent, function getFacts(factsed) {
          expect(factsed.display_host).match(ipv6Pattern)
          os.networkInterfaces = original_NI
          done()
        })
      })
    it("returns no ip addresses, hostname should be 'UNKNOWN_BOX' (everything broke)",
      function broken(done) {
        var mockedNI = {lo: [], en0: []}
        var original_NI = os.networkInterfaces
        os.networkInterfaces = createMock(mockedNI)

        facts(agent, function getFacts(factsed) {
          os.networkInterfaces = original_NI
          expect(factsed.display_host).equal('UNKNOWN_BOX')
          done()
        })
      })
  })
})

function createMock(output) {
  return function mock() {
    return output
  }
}
