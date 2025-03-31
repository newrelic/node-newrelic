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
  // TODO: How do we access Azure Function invocation context?
  if (process.env.REGION_NAME && process.env.WEBSITE_OWNER_NAME && process.env.WEBSITE_SITE_NAME) {
    // Derive vendor metadata from environment variables.
    const subscriptionId = process.env.WEBSITE_OWNER_NAME.split('+')[0]
    // eslint-disable-next-line no-useless-escape
    const resourceGroupName = process.env.WEBSITE_RESOURCE_GROUP ?? process.env.WEBSITE_OWNER_NAME.match(/\+([a-zA-Z0-9\-]+)-[a-zA-Z0-9]+(?:-Linux)?/)?.[0]?.slice(1)
    const azureFunctionAppName = process.env.WEBSITE_SITE_NAME
    results = {
      'faas.app_name': `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${azureFunctionAppName}`,
      'cloud.region': process.env.REGION_NAME
    }
  } else {
    logger.debug('Azure Function metadata was invalid.')
    // TODO: Create NAMES.UTILIZATION.AZUREFUNCTION_ERROR ?
    agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.AZURE_ERROR).incrementCallCount()
  }

  // Call back!
  callback(null, results)
}
