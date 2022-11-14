/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function isValidHarvestConfig(harvestConfig) {
  if (harvestConfig == null) {
    return false
  }

  const harvestLimits = harvestConfig.harvest_limits

  return (
    isValidHarvestValue(harvestConfig.report_period_ms) &&
    harvestLimits != null &&
    Object.keys(harvestLimits).length > 0
  )
}

function isValidHarvestValue(value) {
  return !!(value != null && value >= 0)
}

module.exports = {
  isValidHarvestConfig: isValidHarvestConfig,
  isValidHarvestValue: isValidHarvestValue
}
