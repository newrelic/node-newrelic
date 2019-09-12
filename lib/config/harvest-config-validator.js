'use strict'

function isValidHarvestConfig(harvestConfig) {
  const harvestLimits = harvestConfig.harvest_limits

  const isValid =
    isValidHarvestValue(harvestConfig.report_period_ms) &&
    harvestLimits != null &&
    (
      isValidHarvestValue(harvestLimits.analytic_event_data) ||
      isValidHarvestValue(harvestLimits.custom_event_data) ||
      isValidHarvestValue(harvestLimits.error_event_data) ||
      isValidHarvestValue(harvestLimits.span_event_data)
    )

  return isValid
}

function isValidHarvestValue(value) {
  const isValid = (value != null) && (value >= 0)
  return !!isValid
}

module.exports = {
  isValidHarvestConfig: isValidHarvestConfig,
  isValidHarvestValue: isValidHarvestValue
}
