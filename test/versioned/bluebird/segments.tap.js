'use strict'

var testsDir = '../../integration/instrumentation/promises'

var helper = require('../../lib/agent_helper')
var tap = require('tap')
var testPromiseSegments = require(testsDir + '/segments')


tap.test('bluebird', function(t) {
  t.autoend()

  t.test('segments', function(t) {
    var agent = setupAgent(t)
    var Promise = require('bluebird')
    testPromiseSegments(t, agent, Promise)
    t.autoend()
  })
})

function setupAgent(t, enableSegments) {
  var agent = helper.instrumentMockedAgent({promise_segments: enableSegments})
  t.tearDown(function tearDown() {
    helper.unloadAgent(agent)
  })
  return agent
}
