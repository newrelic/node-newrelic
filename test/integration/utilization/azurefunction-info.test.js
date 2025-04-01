/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('assert')
const fetchAzureFunctionInfo = require('../../../lib/utilization/azurefunction-info')

test('fetchAzureFunctionInfo should return null if detect_azurefunction is disabled', (t, end) => {
  const agent = {
    config: {
      utilization: {
        detect_azurefunction: false
      }
    }
  }

  fetchAzureFunctionInfo(agent, (err, result) => {
    assert.strictEqual(err, null)
    assert.strictEqual(result, null)
    end()
  })
})

test('fetchAzureFunctionInfo should derive metadata from required environment variables', (t, end) => {
  const agent = {
    config: {
      utilization: {
        detect_azurefunction: true
      }
    }
  }

  process.env.REGION_NAME = 'Central US'
  process.env.WEBSITE_OWNER_NAME = '12345+resource-group'
  process.env.WEBSITE_SITE_NAME = 'my-function-app'

  fetchAzureFunctionInfo.clearCache()
  fetchAzureFunctionInfo(agent, (err, result) => {
    assert.strictEqual(err, null)
    assert.deepStrictEqual(result, {
      'faas.app_name': '/subscriptions/12345/resourceGroups/resource-group/providers/Microsoft.Web/sites/my-function-app',
      'cloud.region': 'Central US'
    })
    end()
  })
})

test('fetchAzureFunctionInfo should derive metadata from required and optional environment variables', (t, end) => {
  const agent = {
    config: {
      utilization: {
        detect_azurefunction: true
      }
    }
  }

  process.env.REGION_NAME = 'Central US'
  process.env.WEBSITE_RESOURCE_GROUP = 'resource-group'
  process.env.WEBSITE_OWNER_NAME = '12345+resource-group'
  process.env.WEBSITE_SITE_NAME = 'my-function-app'

  fetchAzureFunctionInfo.clearCache()
  fetchAzureFunctionInfo(agent, (err, result) => {
    assert.strictEqual(err, null)
    assert.deepStrictEqual(result, {
      'faas.app_name': '/subscriptions/12345/resourceGroups/resource-group/providers/Microsoft.Web/sites/my-function-app',
      'cloud.region': 'Central US'
    })
    end()
  })
})
