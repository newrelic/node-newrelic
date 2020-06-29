/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'


const tap = require('tap')
const helper = require('../../lib/agent_helper')

tap.test('synthetics transaction traces', (t) => {
  t.autoend()

  let agent

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent({
      trusted_account_ids: [357]
    })

    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    done()
  })

  t.test('should include synthetic intrinsics if header is set', (t) => {
    helper.runInTransaction(agent, function(txn) {
      txn.syntheticsData = {
        version: 1,
        accountId: 357,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      txn.end()
      const trace = txn.trace
      t.equal(trace.intrinsics.synthetics_resource_id, 'resId')
      t.equal(trace.intrinsics.synthetics_job_id, 'jobId')
      t.equal(trace.intrinsics.synthetics_monitor_id, 'monId')

      t.end()
    })
  })
})
