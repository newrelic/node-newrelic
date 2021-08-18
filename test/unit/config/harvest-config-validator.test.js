/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const harvestConfigValidator = require('../../../lib/config/harvest-config-validator')

tap.test('#isValidHarvestValue', (t) => {
  t.autoend()

  t.test('should be valid when positive number', (t) => {
    const isValid = harvestConfigValidator.isValidHarvestValue(1)
    t.equal(isValid, true)

    t.end()
  })

  t.test('should be valid when zero', (t) => {
    const isValid = harvestConfigValidator.isValidHarvestValue(0)
    t.equal(isValid, true)

    t.end()
  })

  t.test('should be invalid when null', (t) => {
    const isValid = harvestConfigValidator.isValidHarvestValue(null)
    t.equal(isValid, false)

    t.end()
  })

  t.test('should be invalid when undefined', (t) => {
    const isValid = harvestConfigValidator.isValidHarvestValue()
    t.equal(isValid, false)

    t.end()
  })

  t.test('should be invalid when less than zero', (t) => {
    const isValid = harvestConfigValidator.isValidHarvestValue(-1)
    t.equal(isValid, false)

    t.end()
  })
})

tap.test('#isHarvestConfigValid', (t) => {
  t.autoend()

  t.test('should be valid with valid config', (t) => {
    const validConfig = getValidHarvestConfig()
    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)

    t.equal(isValidConfig, true)

    t.end()
  })

  t.test('should be invalid with invalid report_period', (t) => {
    const invalidConfig = getValidHarvestConfig()
    invalidConfig.report_period_ms = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(invalidConfig)
    t.equal(isValidConfig, false)

    t.end()
  })

  t.test('should be invalid with missing harvest_limits', (t) => {
    const invalidConfig = getValidHarvestConfig()
    invalidConfig.harvest_limits = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(invalidConfig)
    t.equal(isValidConfig, false)

    t.end()
  })

  t.test('should be invalid with empty harvest_limits', (t) => {
    const invalidConfig = getValidHarvestConfig()
    invalidConfig.harvest_limits = {}

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(invalidConfig)
    t.equal(isValidConfig, false)

    t.end()
  })

  // TODO: organize the valids together
  t.test('should be valid with valid analytic_event_data', (t) => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.error_event_data = null
    validConfig.harvest_limits.custom_event_data = null
    validConfig.harvest_limits.span_event_data = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
    t.equal(isValidConfig, true)

    t.end()
  })

  t.test('should be valid with custom_event_data', (t) => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.error_event_data = null
    validConfig.harvest_limits.analytic_event_data = null
    validConfig.harvest_limits.span_event_data = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
    t.equal(isValidConfig, true)

    t.end()
  })

  t.test('should be valid with valid error_event_data', (t) => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.custom_event_data = null
    validConfig.harvest_limits.analytic_event_data = null
    validConfig.harvest_limits.span_event_data = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
    t.equal(isValidConfig, true)

    t.end()
  })

  t.test('should be valid with valid span_event_data', (t) => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.error_event_data = null
    validConfig.harvest_limits.custom_event_data = null
    validConfig.harvest_limits.analytic_event_data = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
    t.equal(isValidConfig, true)

    t.end()
  })
})

function getValidHarvestConfig() {
  const validHarvestConfig = {
    report_period_ms: 5000,
    harvest_limits: {
      analytic_event_data: 833,
      custom_event_data: 833,
      error_event_data: 8,
      span_event_data: 300
    }
  }

  return validHarvestConfig
}
