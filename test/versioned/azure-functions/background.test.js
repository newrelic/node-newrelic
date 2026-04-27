/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { once } = require('node:events')
const helper = require('../../lib/agent_helper.js')
const { removeModules } = require('../../lib/cache-buster.js')
const Transaction = require('../../../lib/transaction/index.js')
const { copyFakeCorePkg } = require('./utils.js')

const { DESTINATIONS: DESTS } = Transaction

// As pulled from https://github.com/Azure/azure-functions-nodejs-library/blob/138c021/src/app.ts
// Excludes HTTP methods as they are tested by the HTTP trigger
// instrumentation.
// Excludes the "generic" method as it should be verified on its own.
const azureFunctionsAppMethods = {
  cosmosDB: {
    trigger: 'cosmosDBTrigger',
    triggerType: 'datasource',
    payload: {}
  },

  eventGrid: {
    trigger: 'eventGridTrigger',
    triggerType: 'pubsub',
    payload: {}
  },

  eventHub: {
    trigger: 'eventHubTrigger',
    triggerType: 'pubsub',
    payload: {}
  },

  mySql: {
    trigger: 'mysqlTrigger',
    triggerType: 'datasource',
    payload: {}
  },

  serviceBusQueue: {
    trigger: 'serviceBusTrigger',
    triggerType: 'pubsub',
    payload: {}
  },

  serviceBusTopic: {
    trigger: 'serviceBusTrigger',
    triggerType: 'pubsub',
    payload: {}
  },

  sql: {
    trigger: 'sqlTrigger',
    triggerType: 'datasource',
    payload: {}
  },

  storageBlob: {
    trigger: 'blobTrigger',
    triggerType: 'datasource',
    payload: {}
  },

  storageQueue: {
    trigger: 'queueTrigger',
    triggerType: 'datasource',
    payload: {}
  },

  timer: {
    trigger: 'timerTrigger',
    triggerType: 'timer',
    payload: { timer: 'payload' }
  },

  warmup: {
    trigger: 'warmupTrigger',
    triggerType: 'other',
    payload: {}
  },

  webPubSub: {
    trigger: 'webPubSubTrigger',
    triggerType: 'pubsub',
    payload: {}
  }
}

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
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

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['@azure/functions', '@azure/functions-core'])

  delete process.env.WEBSITE_OWNER_NAME
  delete process.env.WEBSITE_RESOURCE_GROUP
  delete process.env.WEBSITE_SITE_NAME
})

function bootstrapModule({ t }) {
  copyFakeCorePkg()
  const { app } = require('@azure/functions')

  const mockApi = {
    handlers: {},
    request(method, handler) {
      return handler(azureFunctionsAppMethods[method].payload, {
        invocationId: 'test-123',
        functionName: `test-func-${method}`,
        options: {
          trigger: {
            type: azureFunctionsAppMethods[method].trigger
          }
        }
      })
    },
    app
  }

  t.nr.mockApi = mockApi
}

test('does not create new transaction when one already exists', async (t) => {
  bootstrapModule({ t })
  const { agent, mockApi } = t.nr

  const handler = async function () {}
  const options = { handler }

  mockApi.app.timer('a-test', options)
  const wrappedHandler = global.azure.handlers.at(-1)

  await helper.runInTransaction(agent, async (existingTx) => {
    await mockApi.request('timer', wrappedHandler)

    // Should still be in the same transaction, not a new one
    const currentTx = agent.tracer.getTransaction()
    assert.equal(currentTx.id, existingTx.id, 'should reuse existing transaction')
  })
})

test('instruments background methods', async (t) => {
  bootstrapModule({ t })
  const { agent, mockApi } = t.nr

  for (const [method, value] of Object.entries(azureFunctionsAppMethods)) {
    const txFinished = once(agent, 'transactionFinished')
    const handler = async function (input) {
      assert.deepStrictEqual(input, value.payload)
    }

    const key = `${value.triggerType.toUpperCase()}_${method}`
    const options = { handler }
    mockApi.app[method](`${key}-test`, options)
    const wrappedHandler = global.azure.handlers.at(-1)
    await mockApi.request(method, wrappedHandler)

    const [tx] = await txFinished
    assert.ok(tx)

    const attributes = tx.trace.attributes.get(DESTS.TRANS_COMMON)
    if (Object.hasOwn(attributes, 'faas.coldStart')) {
      assert.equal(attributes['faas.coldStart'], true)
    }
    assert.equal(attributes['faas.invocation_id'], 'test-123')
    assert.equal(attributes['faas.name'], `test-func-${method}`)
    assert.equal(attributes['faas.trigger'], value.triggerType, `${method} maps to correct faas.trigger`)
    assert.equal(
      attributes['cloud.resource_id'],
      `/subscriptions/b999997b-cb91-49e0-b922-c9188372bdba/resourceGroups/test-group/providers/Microsoft.Web/sites/test-site/functions/test-func-${method}`
    )

    const metrics = tx.metrics.unscoped
    const expectedMetrics = [
      'OtherTransaction/all',
      `OtherTransaction/AzureFunction/test-func-${method}`,
      'OtherTransactionTotalTime',
      `OtherTransactionTotalTime/AzureFunction/test-func-${method}`
    ]
    for (const expectedMetric of expectedMetrics) {
      assert.equal(metrics[expectedMetric]?.callCount, 1, `callCount for ${expectedMetric} should be 1`)
    }
  }
})
