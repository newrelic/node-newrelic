/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const expect = require('chai').expect
const helper = require('../../lib/agent_helper.js')
const proxyquire = require('proxyquire')

describe('getVendors', function () {
  let agent

  beforeEach(function () {
    agent = helper.loadMockedAgent()
    agent.config.utilization = {
      detect_aws: true,
      detect_azure: true,
      detect_gcp: true,
      detect_docker: true,
      detect_kubernetes: true,
      detect_pcf: true
    }
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it('calls all vendors', function (done) {
    let awsCalled = false
    let azureCalled = false
    let gcpCalled = false
    let dockerCalled = false
    let kubernetesCalled = false
    let pcfCalled = false

    const getVendors = proxyquire('../../../lib/utilization', {
      './aws-info': function (agentArg, cb) {
        awsCalled = true
        cb()
      },
      './azure-info': function (agentArg, cb) {
        azureCalled = true
        cb()
      },
      './gcp-info': function (agentArg, cb) {
        gcpCalled = true
        cb()
      },
      './docker-info': {
        getVendorInfo: function (agentArg, cb) {
          dockerCalled = true
          cb()
        }
      },
      './kubernetes-info': (agentArg, cb) => {
        kubernetesCalled = true
        cb()
      },
      './pcf-info': (agentArg, cb) => {
        pcfCalled = true
        cb()
      }
    }).getVendors

    getVendors(agent, function (err) {
      expect(err).to.be.null
      expect(awsCalled).to.be.true
      expect(azureCalled).to.be.true
      expect(gcpCalled).to.be.true
      expect(dockerCalled).to.be.true
      expect(kubernetesCalled).to.be.true
      expect(pcfCalled).to.be.true
      done()
    })
  })

  it('returns multiple vendors if available', function (done) {
    const getVendors = proxyquire('../../../lib/utilization', {
      './aws-info': function (agentArg, cb) {
        cb(null, 'aws info')
      },
      './docker-info': {
        getVendorInfo: function (agentArg, cb) {
          cb(null, 'docker info')
        }
      }
    }).getVendors

    getVendors(agent, function (err, vendors) {
      expect(err).to.be.null
      expect(vendors.aws).to.equal('aws info')
      expect(vendors.docker).to.equal('docker info')
      done()
    })
  })
})
