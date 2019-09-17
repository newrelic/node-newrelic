'use strict'

function isValidHarvestConfig(harvestConfig) {
  if (harvestConfig == null) {
    return false
  }

  const harvestLimits = harvestConfig.harvest_limits

  const isValid =
    isValidHarvestValue(harvestConfig.report_period_ms) &&
    harvestLimits != null &&
    Object.keys(harvestLimits).length > 0

  return isValid
}

function isValidHarvestValue(value) {
  const isValid = value != null && (value >= 0)
  return !!isValid
}

module.exports = {
  isValidHarvestConfig: isValidHarvestConfig,
  isValidHarvestValue: isValidHarvestValue
}
