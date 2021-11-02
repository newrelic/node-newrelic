/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { test } = require('tap')
const helper = require('../../lib/agent_helper.js')
const proxyquire = require('proxyquire')

test('getVendors', function (t) {
  t.autoend()
  let agent

  t.beforeEach(function () {
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

  t.afterEach(function () {
    helper.unloadAgent(agent)
  })

  t.test('calls all vendors', function (t) {
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
      t.error(err)
      t.ok(awsCalled)
      t.ok(azureCalled)
      t.ok(gcpCalled)
      t.ok(dockerCalled)
      t.ok(kubernetesCalled)
      t.ok(pcfCalled)
      t.end()
    })
  })

  t.test('returns multiple vendors if available', function (t) {
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
      t.error(err)
      t.equal(vendors.aws, 'aws info')
      t.equal(vendors.docker, 'docker info')
      t.end()
    })
  })
})
