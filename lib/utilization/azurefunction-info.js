/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger.js').child({ component: 'azurefunction-info' })
const NAMES = require('../metrics/names.js')
let results = null

module.exports = fetchAzureFunctionInfo
module.exports.clearCache = function clearAzureFunctionCache() {
  results = null
}

function fetchAzureFunctionInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_azurefunction) {
    return setImmediate(callback, null, null)
  }

  if (results) {
    return setImmediate(callback, null, results)
  }

  // Detect if Azure Function.
  if (process.env.REGION_NAME && process.env.WEBSITE_OWNER_NAME && process.env.WEBSITE_SITE_NAME) {
    // Derive vendor metadata from environment variables.
    const subscriptionId = process.env.WEBSITE_OWNER_NAME.split('+')[0]
    const resourceGroupName = process.env.WEBSITE_RESOURCE_GROUP ?? process.env.WEBSITE_OWNER_NAME.split('+').pop().split('-Linux').shift()
    const azureFunctionAppName = process.env.WEBSITE_SITE_NAME
    if (subscriptionId && resourceGroupName) {
      results = {
        'faas.app_name': `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${azureFunctionAppName}`,
        'cloud.region': process.env.REGION_NAME
      }
    }
  } else {
    logger.debug('Azure Function metadata was invalid.')
    // TODO: Create NAMES.UTILIZATION.AZUREFUNCTION_ERROR ?
    agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.AZURE_ERROR).incrementCallCount()
  }

  // Call back!
  callback(null, results)
}
