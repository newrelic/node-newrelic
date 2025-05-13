/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const fetchAzureFunctionInfo = require('#agentlib/utilization/azurefunction-info.js')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent({
    config: {
      utilization: {
        detect_azurefunction: true
      }
    }
  })
  ctx.nr = { agent }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.agent = null
  fetchAzureFunctionInfo.clearCache()
})

test('should return null if detect_azurefunction is disabled', (ctx, end) => {
  const agent = ctx.nr.agent
  agent.config.utilization.detect_azurefunction = false

  fetchAzureFunctionInfo(agent, (err, result) => {
    assert.strictEqual(err, null)
    assert.strictEqual(result, null)
    end()
  })
})

test('should increment error metric if required environment variables are missing', (ctx, end) => {
  const agent = ctx.nr.agent
  const azureErrorMetric = agent.metrics.getOrCreateMetric('Supportability/utilization/azure/error')

  const initialCallCount = azureErrorMetric.callCount

  fetchAzureFunctionInfo(agent, (err, result) => {
    assert.strictEqual(err, null)
    assert.strictEqual(result, null)
    assert.strictEqual(azureErrorMetric.callCount, initialCallCount + 1)
    end()
  })
})

test('should derive metadata from required environment variables', (ctx, end) => {
  const agent = ctx.nr.agent

  process.env.REGION_NAME = 'Central US'
  process.env.WEBSITE_OWNER_NAME = '12345+resource-group'
  process.env.WEBSITE_SITE_NAME = 'my-function-app'

  fetchAzureFunctionInfo(agent, (err, result) => {
    assert.strictEqual(err, null)
    assert.deepStrictEqual(result, {
      'faas.app_name': '/subscriptions/12345/resourceGroups/resource-group/providers/Microsoft.Web/sites/my-function-app',
      'cloud.region': 'Central US'
    })
    end()
  })
})

test('should derive metadata from required and optional environment variables', (ctx, end) => {
  const agent = ctx.nr.agent

  process.env.REGION_NAME = 'Central US'
  process.env.WEBSITE_RESOURCE_GROUP = 'resource-group-actual'
  process.env.WEBSITE_OWNER_NAME = '12345+resource-group'
  process.env.WEBSITE_SITE_NAME = 'my-function-app'

  fetchAzureFunctionInfo(agent, (err, result) => {
    assert.strictEqual(err, null)
    assert.deepStrictEqual(result, {
      'faas.app_name': '/subscriptions/12345/resourceGroups/resource-group-actual/providers/Microsoft.Web/sites/my-function-app',
      'cloud.region': 'Central US'
    })
    end()
  })
})
