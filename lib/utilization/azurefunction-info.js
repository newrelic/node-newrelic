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
    logger.trace({ utilization: 'azurefunction' }, 'Skipping Azure function due to being disabled via config.')
    return setImmediate(callback, null, null)
  }

  if (results) {
    logger.trace({ utilization: 'azurefunction' }, 'Returning previously found results.')
    return setImmediate(callback, null, results)
  }

  // Detect if Azure Function.
  const { REGION_NAME, WEBSITE_OWNER_NAME, WEBSITE_SITE_NAME, WEBSITE_RESOURCE_GROUP } = process.env
  if (!REGION_NAME || !WEBSITE_OWNER_NAME || !WEBSITE_SITE_NAME) {
    logger.debug({ utilization: 'azurefunction' }, 'Azure Function metadata was invalid.')
    agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.AZURE_ERROR).incrementCallCount()
    return setImmediate(callback, null, null)
  }

  // Derive vendor metadata from environment variables.
  const subscriptionId = WEBSITE_OWNER_NAME.split('+')[0]
  const resourceGroupName = WEBSITE_RESOURCE_GROUP ?? WEBSITE_OWNER_NAME.split('+').pop().split('-Linux').shift() ?? 'unknown'
  const azureFunctionAppName = WEBSITE_SITE_NAME
  results = {
    'faas.app_name': `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${azureFunctionAppName}`,
    'cloud.region': REGION_NAME
  }

  callback(null, results)
}
