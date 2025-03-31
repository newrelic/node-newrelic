/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper.js')
const proxyquire = require('proxyquire')

test('getVendors', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
    ctx.nr.agent.config.utilization = {
      detect_aws: true,
      detect_azure: true,
      detect_azurefunction: true,
      detect_gcp: true,
      detect_docker: true,
      detect_kubernetes: true,
      detect_pcf: true
    }
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('calls all vendors', function (ctx, end) {
    const { agent } = ctx.nr
    let awsCalled = false
    let azureCalled = false
    let azureFunctionCalled = false
    let gcpCalled = false
    let dockerCalled = false
    let ecsCalled = false
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
      './azurefunction-info': function (agentArg, cb) {
        azureFunctionCalled = true
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
      './ecs-info': function (agentArg, cb) {
        ecsCalled = true
        cb()
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
      assert.ifError(err)
      assert.ok(awsCalled)
      assert.ok(azureCalled)
      assert.ok(azureFunctionCalled)
      assert.ok(gcpCalled)
      assert.ok(dockerCalled)
      assert.ok(ecsCalled)
      assert.ok(kubernetesCalled)
      assert.ok(pcfCalled)
      end()
    })
  })

  await t.test('returns multiple vendors if available', function (ctx, end) {
    const { agent } = ctx.nr
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
      assert.ifError(err)
      assert.equal(vendors.aws, 'aws info')
      assert.equal(vendors.docker, 'docker info')
      end()
    })
  })
})
