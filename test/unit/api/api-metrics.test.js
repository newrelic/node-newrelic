'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var API = require('../../../api')
var NAMES = require('../../../lib/metrics/names')


describe('The API supportability metrics', function() {
  var agent
  var api

  var apiCalls = Object.keys(API.prototype)

  beforeEach(function() {
    agent = helper.loadMockedAgent()
    api = new API(agent)
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  for (var i = 0; i < apiCalls.length; i++) {
    testMetricCalls(apiCalls[i])
  }

  function testMetricCalls(name) {
    var message = 'should create a metric for API#' + name
    it(message, function() {
      var beforeMetric = agent.metrics.getOrCreateMetric(
        NAMES.SUPPORTABILITY.API + '/' + name
      )
      expect(beforeMetric.callCount).equal(0)

      // Some api calls required a name to be given rather than just an empty string
      api[name]('test')

      var afterMetric = agent.metrics.getOrCreateMetric(
        NAMES.SUPPORTABILITY.API + '/' + name
      )
      expect(afterMetric.callCount).equal(1)
    })
  }
})
