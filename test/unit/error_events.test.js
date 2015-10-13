'use strict'

var path         = require('path')
  , helper       = require('../lib/agent_helper.js')
  , chai         = require('chai')
  , expect       = chai.expect
  , Transaction  = require('../../lib/transaction')


describe('when error events are disabled', function () {
  var agent

  beforeEach(function () {
    agent = helper.loadMockedAgent()
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it("should not send events to server", function (done) {
    agent.collector.errorEvents = function () {
      throw new Error('Should not have sent error events.')
    }
    agent.config.error_collector.capture_events = false
    agent.errors.add(null, new Error('some error'))
    agent._sendErrorEvents(function cb__sendEvents() {
      done()
    })
  })

  it('collector can override', function () {
    agent.config.error_collector.capture_events = false
    expect(function () {
      agent.config.onConnect({ 'error_collector.capture_events': true })
    }).not.throws()
    expect(agent.config.error_collector.capture_events).equals(true)
  })
})

describe('when error events are enabled', function () {
  var agent

  beforeEach(function () {
    agent = helper.loadMockedAgent()
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it("should send events to server", function (done) {
    agent.collector.isConnected = function() { return true }
    agent.collector.metricData = function(payload, cb) { cb() }
    agent.collector.errorEvents = function () { done() }

    agent.config.error_collector.capture_events = true
    agent.errors.add(null, new Error('some error'))

    agent._sendMetrics(function() {
      agent._sendErrorEvents(function cb_sendErrorEvents() {})
    })
  })

  it('collector can override', function () {
    agent.config.error_collector.capture_events = true
    expect(function () {
      agent.config.onConnect({ 'error_collector.capture_events': false })
    }).not.throws()
    expect(agent.config.error_collector.capture_events).equals(false)
  })

  it('collector can disable using the emergency shut off', function () {
    agent.config.error_collector.capture_events = true
    expect(function () {
      agent.config.onConnect({ collect_error_events: false })
    }).not.throws()
    expect(agent.config.error_collector.capture_events).equals(false)
  })

  it('collector cannot enable using the emergency shut off', function () {
    agent.config.error_collector.capture_events = false
    expect(function () {
      agent.config.onConnect({ collect_error_events: true })
    }).not.throws()
    expect(agent.config.error_collector.capture_events).equals(false)
  })
})

describe('top-level setting collect_error_events setting', function() {
  var agent

  beforeEach(function () {
    agent = helper.loadMockedAgent()
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it('overrides error_collector.capture_events when set to "false"', function() {
    agent.collector.errorEvents = function () {
      throw new Error(); // FAIL
    }
    agent.config.error_collector.capture_events = true
    agent.config.collect_error_events = false
    agent._sendErrorEvents(function cb__sendEvents() {
      done()
    })
  })

  it('does not override error_collector.capture_events when set to "true"', function() {
    agent.collector.errorEvents = function () {
      throw new Error(); // FAIL
    }
    agent.config.error_collector.capture_events = false
    agent.config.collect_error_events = true
    agent._sendErrorEvents(function cb__sendEvents() {
      done()
    })
  })
})