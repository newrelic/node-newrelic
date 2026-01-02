/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { describe, test } = require('node:test')
const assert = require('node:assert')

const helper = require('#testlib/agent_helper.js')
const { getVendors } = require('#agentlib/utilization/index.js')

describe('getVendors', () => {
  test.beforeEach(function (ctx) {
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

  test.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
  })

  test('calls all vendors', async (ctx) => {
    const { agent } = ctx.nr
    let awsCalled = false
    let azureCalled = false
    let azureFunctionCalled = false
    let gcpCalled = false
    let dockerCalled = false
    let ecsCalled = false
    let kubernetesCalled = false
    let pcfCalled = false

    const vendorDataFuncs = {
      aws (agentArg, cb) {
        awsCalled = true
        cb()
      },
      azure (agentArg, cb) {
        azureCalled = true
        cb()
      },
      azurefunction (agentArg, cb) {
        azureFunctionCalled = true
        cb()
      },
      docker (agentArg, cb) {
        dockerCalled = true
        cb()
      },
      ecs (agentArg, cb) {
        ecsCalled = true
        cb()
      },
      gcp (agentArg, cb) {
        gcpCalled = true
        cb()
      },
      kubernetes (agentArg, cb) {
        kubernetesCalled = true
        cb()
      },
      pcf (agentArg, cb) {
        pcfCalled = true
        cb()
      }
    }

    try {
      await getVendors(agent, { vendorDataFuncs })
    } catch (error) {
      assert.ifError(error)
    }
    assert.ok(awsCalled)
    assert.ok(azureCalled)
    assert.ok(azureFunctionCalled)
    assert.ok(gcpCalled)
    assert.ok(dockerCalled)
    assert.ok(ecsCalled)
    assert.ok(kubernetesCalled)
    assert.ok(pcfCalled)
  })

  test('returns multiple vendors if available', async (ctx) => {
    const { agent } = ctx.nr
    const vendorDataFuncs = {
      aws (agentArg, cb) {
        cb(null, 'aws info')
      },
      docker (agentArg, cb) {
        cb(null, 'docker info')
      }
    }

    let vendors
    try {
      vendors = await getVendors(agent, { vendorDataFuncs })
    } catch (error) {
      assert.ifError(error)
    }

    assert.equal(vendors.aws, 'aws info')
    assert.equal(vendors.docker, 'docker info')
  })

  test('logs messages for success case', async (t) => {
    const { agent } = t.nr
    const vendorDataFuncs = {
      aws (agentArg, cb) {
        cb(null, 'aws info')
      }
    }
    const logs = {
      error: [],
      info: [],
      trace: []
    }
    const logger = {
      error(...args) {
        logs.error.push(args)
      },
      info(...args) {
        logs.info.push(args)
      },
      trace(...args) {
        logs.trace.push(args)
      }
    }

    await getVendors(agent, { vendorDataFuncs, logger })
    assert.equal(logs.error.length, 0)
    assert.equal(logs.info.length, 1)
    assert.equal(logs.trace.length, 2)

    assert.deepStrictEqual(logs.info[0], [
      { utilization: 'aws', result: 'aws info' },
      'Information for vendor %s retrieved successfully.',
      'aws'
    ])
    assert.deepStrictEqual(logs.trace[0], [
      { utilization: 'aws' },
      'Detecting utilization info for vendor %s.',
      'aws'
    ])
    assert.deepStrictEqual(logs.trace[1], [
      { utilization: 'aws' },
      'Vendor %s finished.',
      'aws'
    ])
  })

  test('logs messages for error case', async (t) => {
    const { agent } = t.nr
    const vendorDataFuncs = {
      aws (agentArg, cb) {
        cb(Error('boom'))
      }
    }
    const logs = {
      error: [],
      info: [],
      trace: []
    }
    const logger = {
      error(...args) {
        logs.error.push(args)
      },
      info(...args) {
        logs.info.push(args)
      },
      trace(...args) {
        logs.trace.push(args)
      }
    }

    await getVendors(agent, { vendorDataFuncs, logger })
    assert.equal(logs.error.length, 1)
    assert.equal(logs.info.length, 0)
    assert.equal(logs.trace.length, 2)

    const [metadata, msg, vendor] = logs.error[0]
    assert.equal(msg, 'Failed to get information about vendor %s.')
    assert.equal(vendor, 'aws')
    assert.equal(metadata.utilization, 'aws')
    assert.equal(metadata.result, null)
    assert.match(metadata.error.message, /boom/)

    assert.deepStrictEqual(logs.trace[0], [
      { utilization: 'aws' },
      'Detecting utilization info for vendor %s.',
      'aws'
    ])
    assert.deepStrictEqual(logs.trace[1], [
      { utilization: 'aws' },
      'Vendor %s finished.',
      'aws'
    ])
  })

  test('logs message for null/undefined information result', async (t) => {
    const { agent } = t.nr
    const vendorDataFuncs = {
      aws (agentArg, cb) {
        cb(null, null)
      },
      foo (agentArg, cb) {
        cb(null)
      }
    }
    const logs = {
      error: [],
      info: [],
      trace: []
    }
    const logger = {
      error(...args) {
        logs.error.push(args)
      },
      info(...args) {
        logs.info.push(args)
      },
      trace(...args) {
        logs.trace.push(args)
      }
    }

    await getVendors(agent, { vendorDataFuncs, logger })
    assert.equal(logs.error.length, 0)
    assert.equal(logs.info.length, 0)
    assert.equal(logs.trace.length, 6)

    assert.equal(
      hasLog(logs.trace, [
        { utilization: 'aws' },
        'Detecting utilization info for vendor %s.',
        'aws'
      ]),
      true
    )
    assert.equal(
      hasLog(logs.trace, [
        { utilization: 'aws' },
        'No information returned for vendor %s.',
        'aws'
      ]),
      true
    )
    assert.equal(
      hasLog(logs.trace, [
        { utilization: 'aws' },
        'Vendor %s finished.',
        'aws'
      ]),
      true
    )

    assert.equal(
      hasLog(logs.trace, [
        { utilization: 'foo' },
        'Detecting utilization info for vendor %s.',
        'foo'
      ]),
      true
    )
    assert.equal(
      hasLog(logs.trace, [
        { utilization: 'foo' },
        'No information returned for vendor %s.',
        'foo'
      ]),
      true
    )
    assert.equal(
      hasLog(logs.trace, [
        { utilization: 'foo' },
        'Vendor %s finished.',
        'foo'
      ]),
      true
    )
  })
})

function hasLog(logs, log) {
  return logs.find(
    (l) => {
      if (l[0].utilization !== log[0].utilization) return false
      return l[1] === log[1] && l[2] === log[2]
    }
  ) !== undefined
}
