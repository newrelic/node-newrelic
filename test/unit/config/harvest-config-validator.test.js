'use strict'

const chai = require('chai')
const expect = chai.expect
const harvestConfigValidator = require('../../../lib/config/harvest-config-validator')

describe('#isValidHarvestValue', () => {
  it('should be valid when positive number', () => {
    const isValid = harvestConfigValidator.isValidHarvestValue(1)
    expect(isValid).to.be.true
  })

  it('should be valid when zero', () => {
    const isValid = harvestConfigValidator.isValidHarvestValue(0)
    expect(isValid).to.be.true
  })

  it('should be invalid when null', () => {
    const isValid = harvestConfigValidator.isValidHarvestValue(null)
    expect(isValid).to.be.false
  })

  it('should be invalid when undefined', () => {
    const isValid = harvestConfigValidator.isValidHarvestValue()
    expect(isValid).to.be.false
  })

  it('should be invalid when less than zero', () => {
    const isValid = harvestConfigValidator.isValidHarvestValue(-1)
    expect(isValid).to.be.false
  })
})

describe('#isHarvestConfigValid', () => {
  describe('with valid config', () => {
    it('should be valid', () => {
      const validConfig = getValidHarvestConfig()
      const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
      expect(isValidConfig).to.be.true
    })
  })

  describe('with invalid report_period', () => {
    const invalidConfig = getValidHarvestConfig()
    invalidConfig.report_period_ms = null

    it('should be invalid', () => {
      const isValidConfig = harvestConfigValidator.isValidHarvestConfig(invalidConfig)
      expect(isValidConfig).to.be.false
    })
  })

  describe('with missing harvest_limits', () => {
    const invalidConfig = getValidHarvestConfig()
    invalidConfig.harvest_limits = null

    it('should be invalid', () => {
      const isValidConfig = harvestConfigValidator.isValidHarvestConfig(invalidConfig)
      expect(isValidConfig).to.be.false
    })
  })

  describe('with empty harvest_limits', () => {
    const invalidConfig = getValidHarvestConfig()
    invalidConfig.harvest_limits = {}

    it('should be invalid', () => {
      const isValidConfig = harvestConfigValidator.isValidHarvestConfig(invalidConfig)
      expect(isValidConfig).to.be.false
    })
  })

  describe('with valid analytic_event_data', () => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.error_event_data = null
    validConfig.harvest_limits.custom_event_data = null
    validConfig.harvest_limits.span_event_data = null

    it('should be valid', () => {
      const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
      expect(isValidConfig).to.be.true
    })
  })

  describe('with valid custom_event_data', () => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.error_event_data = null
    validConfig.harvest_limits.analytic_event_data = null
    validConfig.harvest_limits.span_event_data = null

    it('should be valid', () => {
      const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
      expect(isValidConfig).to.be.true
    })
  })

  describe('with valid error_event_data', () => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.custom_event_data = null
    validConfig.harvest_limits.analytic_event_data = null
    validConfig.harvest_limits.span_event_data = null

    it('should be valid', () => {
      const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
      expect(isValidConfig).to.be.true
    })
  })

  describe('with valid span_event_data', () => {
    const validConfig = getValidHarvestConfig()
    validConfig.harvest_limits.error_event_data = null
    validConfig.harvest_limits.custom_event_data = null
    validConfig.harvest_limits.analytic_event_data = null

    it('should be valid', () => {
      const isValidConfig = harvestConfigValidator.isValidHarvestConfig(validConfig)
      expect(isValidConfig).to.be.true
    })
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
