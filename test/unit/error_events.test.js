'use strict'

var helper = require('../lib/agent_helper')
var chai = require('chai')

var DESTS = require('../../lib/config/attribute-filter').DESTINATIONS
var expect  = chai.expect


describe('Error events', function() {
  describe('when error events are disabled', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it('collector can override', function() {
      agent.config.error_collector.capture_events = false
      expect(function() {
        agent.config.onConnect({ 'error_collector.capture_events': true })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(true)
    })
  })

  describe('when error events are enabled', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
      agent.config.error_collector.capture_events = true
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it('collector can override', function() {
      expect(function() {
        agent.config.onConnect({ 'error_collector.capture_events': false })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(false)
    })

    it('collector can disable using the emergency shut off', function() {
      expect(function() {
        agent.config.onConnect({ collect_error_events: false })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(false)
    })

    it('collector cannot enable using the emergency shut off', function() {
      agent.config.error_collector.capture_events = false
      expect(function() {
        agent.config.onConnect({ collect_error_events: true })
      }).not.throws()
      expect(agent.config.error_collector.capture_events).equals(false)
    })
  })
})
