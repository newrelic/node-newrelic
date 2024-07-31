/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const promiseResolvers = require('../../lib/promise-resolvers')
const helper = require('../../lib/agent_helper')

test('synthetics transaction traces', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      trusted_account_ids: [357]
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should include synthetic intrinsics if header is set', async (t) => {
    const { agent } = t.nr
    const { promise, resolve } = promiseResolvers()

    helper.runInTransaction(agent, function (tx) {
      tx.syntheticsData = {
        version: 1,
        accountId: 357,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      tx.end()
      const trace = tx.trace
      assert.equal(trace.intrinsics.synthetics_resource_id, 'resId')
      assert.equal(trace.intrinsics.synthetics_job_id, 'jobId')
      assert.equal(trace.intrinsics.synthetics_monitor_id, 'monId')

      resolve()
    })

    await promise
  })
})
