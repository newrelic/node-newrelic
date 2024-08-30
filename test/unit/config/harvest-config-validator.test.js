/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const harvestConfigValidator = require('../../../lib/config/harvest-config-validator')

test('#isValidHarvestValue', async (t) => {
  await t.test('should be valid when positive number', () => {
    const isValid = harvestConfigValidator.isValidHarvestValue(1)
    assert.equal(isValid, true)
  })

  await t.test('should be valid when zero', () => {
    const isValid = harvestConfigValidator.isValidHarvestValue(0)
    assert.equal(isValid, true)
  })

  await t.test('should be invalid when null', () => {
    const isValid = harvestConfigValidator.isValidHarvestValue(null)
    assert.equal(isValid, false)
  })

  await t.test('should be invalid when undefined', () => {
    const isValid = harvestConfigValidator.isValidHarvestValue()
    assert.equal(isValid, false)
  })

  await t.test('should be invalid when less than zero', () => {
    const isValid = harvestConfigValidator.isValidHarvestValue(-1)
    assert.equal(isValid, false)
  })
})

test('#isHarvestConfigValid', async (t) => {
  await t.test('should be valid with valid config', () => {
    const validConfig = getValidHarvestConfig()
    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)

    assert.equal(isValidConfig, true)
  })

  await t.test('should be invalid with invalid report_period', () => {
    const invalidConfig = getValidHarvestConfig()
    invalidConfig.report_period_ms = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(invalidConfig)
    assert.equal(isValidConfig, false)
  })

  await t.test('should be invalid with missing harvest_limits', () => {
    const invalidConfig = getValidHarvestConfig()
    invalidConfig.harvest_limits = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(invalidConfig)
    assert.equal(isValidConfig, false)
  })

  await t.test('should be invalid with empty harvest_limits', () => {
    const invalidConfig = getValidHarvestConfig()
    invalidConfig.harvest_limits = {}

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(invalidConfig)
    assert.equal(isValidConfig, false)
  })

  // TODO: organize the valids together
  await t.test('should be valid with valid analytic_event_data', () => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.error_event_data = null
    validConfig.harvest_limits.custom_event_data = null
    validConfig.harvest_limits.span_event_data = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
    assert.equal(isValidConfig, true)
  })

  await t.test('should be valid with custom_event_data', () => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.error_event_data = null
    validConfig.harvest_limits.analytic_event_data = null
    validConfig.harvest_limits.span_event_data = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
    assert.equal(isValidConfig, true)
  })

  await t.test('should be valid with valid error_event_data', () => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.custom_event_data = null
    validConfig.harvest_limits.analytic_event_data = null
    validConfig.harvest_limits.span_event_data = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
    assert.equal(isValidConfig, true)
  })

  await t.test('should be valid with valid span_event_data', () => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.error_event_data = null
    validConfig.harvest_limits.custom_event_data = null
    validConfig.harvest_limits.analytic_event_data = null

    const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
    assert.equal(isValidConfig, true)
  })
})

function getValidHarvestConfig() {
  return {
    report_period_ms: 5000,
    harvest_limits: {
      analytic_event_data: 833,
      custom_event_data: 833,
      error_event_data: 8,
      span_event_data: 300
    }
  }
}
