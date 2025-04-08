/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { once } = require('node:events')

const helper = require('../../lib/agent_helper.js')
const { removeMatchedModules } = require('../../lib/cache-buster.js')
const GenericShim = require('../../../lib/shim/shim.js')
const Transaction = require('../../../lib/transaction/index.js')

const { DESTINATIONS: DESTS } = Transaction
const MODULE_NAME = 'azure-functions'

test.beforeEach(ctx => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
  ctx.nr.shim = new GenericShim(ctx.nr.agent, 'azure-functions')

  ctx.nr.logs = []
  ctx.nr.logger = {
    warn(...args) {
      ctx.nr.logs.push(args)
    }
  }

  process.env.WEBSITE_OWNER_NAME = 'b999997b-cb91-49e0-b922-c9188372bdba+testing-rg-EastUS2webspace-Linux'
  process.env.WEBSITE_RESOURCE_GROUP = 'test-group'
  process.env.WEBSITE_SITE_NAME = 'test-site'
})

test.afterEach(ctx => {
  helper.unloadAgent(ctx.nr.agent)
  removeMatchedModules(/lib\/instrumentation\/@azure\/functions\.js/)

  delete process.env.WEBSITE_OWNER_NAME
  delete process.env.WEBSITE_RESOURCE_GROUP
  delete process.env.WEBSITE_SITE_NAME
})

function bootstrapModule({ t }) {
  t.nr.initialize = require('../../../lib/instrumentation/@azure/functions.js')

  const mockApi = {
    handlers: {},
    request(triggerType) {
      if (triggerType === 'timer') {
        if (Object.hasOwn(mockApi.handlers, 'TIMER') === false) throw Error('must register timer handler first')
        // See https://github.com/Azure/azure-functions-nodejs-library/blob/138c021/types/timer.d.ts#L45-L69
        // if we ever need to mock out a legit shaped payload.
        return mockApi.handlers.TIMER({ timer: 'payload' }, {
          invocationId: 'test-123',
          functionName: 'test-func',
          options: {
            trigger: {
              type: 'timerTrigger'
            }
          }
        })
      }
    },
    app: {
      timer(name, options) {
        mockApi.handlers.TIMER = options.handler
      }
    }
  }
  t.nr.mockApi = mockApi
}

test('instruments timer method', async t => {
  bootstrapModule({ t })
  const { agent, initialize, mockApi, shim } = t.nr
  initialize(agent, mockApi, MODULE_NAME, shim)

  const txFinished = once(agent, 'transactionFinished')
  const handler = async function (payload) {
    assert.deepStrictEqual(payload, { timer: 'payload' })
  }

  mockApi.app.timer('timer-test', { handler })
  await mockApi.request('timer')

  const [tx] = await txFinished
  assert.ok(tx)

  const attributes = tx.trace.attributes.get(DESTS.TRANS_COMMON)
  assert.equal(attributes['faas.coldStart'], true)
  assert.equal(attributes['faas.invocation_id'], 'test-123')
  assert.equal(attributes['faas.name'], 'test-func')
  assert.equal(attributes['faas.trigger'], 'timer')
  assert.equal(
    attributes['cloud.resource_id'],
    '/subscriptions/b999997b-cb91-49e0-b922-c9188372bdba/resourceGroups/test-group/providers/Microsoft.Web/sites/test-site/functions/test-func'
  )

  const metrics = tx.metrics.unscoped
  const expectedMetrics = [
    'OtherTransaction/all',
    'OtherTransaction/AzureFunction/test-func',
    'OtherTransactionTotalTime',
    'OtherTransactionTotalTime/AzureFunction/test-func'
  ]
  for (const expectedMetric of expectedMetrics) {
    assert.equal(metrics[expectedMetric]?.callCount, 1, `callCount for ${expectedMetric} should be 1`)
  }
})
