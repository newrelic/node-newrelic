/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('#testlib/agent_helper.js')
const { removeMatchedModules } = require('#testlib/cache-buster.js')
const GenericShim = require('#agentlib/shim/shim.js')
const Transaction = require('#agentlib/transaction/index.js')

const { DESTINATIONS: DESTS } = require('#agentlib/transaction/index.js')

test.beforeEach((ctx) => {
  ctx.nr = {}

  ctx.nr.agent = helper.loadMockedAgent()
  ctx.nr.shim = new GenericShim(ctx.nr.agent, 'azure-functions')

  process.env.WEBSITE_OWNER_NAME = 'b999997b-cb91-49e0-b922-c9188372bdba+testing-rg-EastUS2webspace-Linux'
  process.env.WEBSITE_RESOURCE_GROUP = 'test-group'
  process.env.WEBSITE_SITE_NAME = 'test-site'
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeMatchedModules(/lib\/instrumentation\/@azure\/functions\.js/)

  delete process.env.WEBSITE_OWNER_NAME
  delete process.env.WEBSITE_RESOURCE_GROUP
  delete process.env.WEBSITE_SITE_NAME
})

function bootstrapModule({ t }) {
  t.nr.initialize = require('#agentlib/instrumentation/@azure/functions.js')
}

test('addAttributes adds expected attributes', (t) => {
  bootstrapModule({ t })
  const { agent } = t.nr
  const { addAttributes } = t.nr.initialize.internals
  const transaction = new Transaction(agent)
  const functionContext = {
    invocationId: 'id-123',
    functionName: 'test-func',
    options: {
      trigger: {
        type: 'httpTrigger'
      }
    }
  }
  addAttributes({ transaction, functionContext })

  const attributes = transaction.trace.attributes.get(DESTS.TRANS_COMMON)
  assert.equal(attributes['faas.invocation_id'], 'id-123')
  assert.equal(attributes['faas.name'], 'test-func')
  assert.equal(attributes['faas.trigger'], 'http')
  assert.equal(
    attributes['cloud.resource_id'],
    '/subscriptions/b999997b-cb91-49e0-b922-c9188372bdba/resourceGroups/test-group/providers/Microsoft.Web/sites/test-site/functions/test-func'
  )
})

test('buildCloudResourceId returns correct string', (t) => {
  bootstrapModule({ t })
  const { buildCloudResourceId } = t.nr.initialize.internals
  const id = buildCloudResourceId({ functionContext: { functionName: 'test-func' } })
  assert.equal(id, [
    '/subscriptions/',
    'b999997b-cb91-49e0-b922-c9188372bdba',
    '/resourceGroups/',
    'test-group',
    '/providers/Microsoft.Web/sites/',
    'test-site',
    '/functions/',
    'test-func'
  ].join(''))
})

test('buildCloudResourceId returns correct string (missing WEBSITE_RESOURCE_GROUP)', (t) => {
  delete process.env.WEBSITE_RESOURCE_GROUP
  bootstrapModule({ t })
  const { buildCloudResourceId } = t.nr.initialize.internals
  const id = buildCloudResourceId({ functionContext: { functionName: 'test-func' } })
  assert.equal(id, [
    '/subscriptions/',
    'b999997b-cb91-49e0-b922-c9188372bdba',
    '/resourceGroups/',
    'testing-rg-EastUS2webspace',
    '/providers/Microsoft.Web/sites/',
    'test-site',
    '/functions/',
    'test-func'
  ].join(''))
})

test('mapTriggerType maps recognized keys', (t) => {
  bootstrapModule({ t })
  const { mapTriggerType } = t.nr.initialize.internals
  const testData = [
    ['blobTrigger', 'datasource'],
    ['cosmosDBTrigger', 'datasource'],
    ['daprBindingTrigger', 'datasource'],
    ['daprServiceInvocationTrigger', 'other'],
    ['daprTopicTrigger', 'pubsub'],
    ['eventGridTrigger', 'pubsub'],
    ['eventHubTrigger', 'pubsub'],
    ['httpTrigger', 'http'],
    ['kafkaTrigger', 'pubsub'],
    ['mysqlTrigger', 'datasource'],
    ['not-recognized', 'other'],
    ['queueTrigger', 'datasource'],
    ['rabbitMQTrigger', 'pubsub'],
    ['redisListTrigger', 'pubsub'],
    ['redisPubSubTrigger', 'pubsub'],
    ['redisStreamTrigger', 'pubsub'],
    ['serviceBusTrigger', 'pubsub'],
    ['signalRTrigger', 'pubsub'],
    ['sqlTrigger', 'datasource'],
    ['timerTrigger', 'timer'],
    ['webPubSubTrigger', 'pubsub'],
  ]

  for (const [input, expected] of testData) {
    const ctx = { options: { trigger: { type: input } } }
    const found = mapTriggerType({ functionContext: ctx })
    assert.equal(found, expected)
  }
})
