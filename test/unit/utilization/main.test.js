'use strict'

var expect = require('chai').expect
var helper = require('../../lib/agent_helper.js')
var proxyquire = require('proxyquire')


describe('getVendors', function() {
  var agent

  before(function() {
    agent = helper.loadMockedAgent()
    agent.config.utilization = {
      detect_aws: true,
      detect_azure: true,
      detect_gcp: true,
      detect_docker: true,
      detect_kubernetes: true
    }
  })

  after(function() {
    helper.unloadAgent(agent)
  })

  it('calls all vendors', function(done) {
    var awsCalled = false
    var azureCalled = false
    var gcpCalled = false
    var dockerCalled = false
    let kubernetesCalled = false

    var getVendors = proxyquire('../../../lib/utilization', {
      './aws-info': function(agentArg, cb) {
        awsCalled = true
        cb()
      },
      './azure-info': function(agentArg, cb) {
        azureCalled = true
        cb()
      },
      './gcp-info': function(agentArg, cb) {
        gcpCalled = true
        cb()
      },
      './docker-info': {
        getVendorInfo: function(agentArg, cb) {
          dockerCalled = true
          cb()
        }
      },
      './kubernetes-info': (agentArg, cb) => {
        kubernetesCalled = true
        cb()
      }
    }).getVendors

    getVendors(agent, function(err) {
      expect(err).to.be.null
      expect(awsCalled).to.be.true
      expect(azureCalled).to.be.true
      expect(gcpCalled).to.be.true
      expect(dockerCalled).to.be.true
      expect(kubernetesCalled).to.be.true
      done()
    })
  })

  it('returns multiple vendors if available', function(done) {
    var getVendors = proxyquire('../../../lib/utilization', {
      './aws-info': function(agentArg, cb) {
        cb(null, 'aws info')
      },
      './docker-info': {
        getVendorInfo: function(agentArg, cb) {
          cb(null, 'docker info')
        }
      }
    }).getVendors

    getVendors(agent, function(err, vendors) {
      expect(err).to.be.null
      expect(vendors.aws).to.equal('aws info')
      expect(vendors.docker).to.equal('docker info')
      done()
    })
  })
})
