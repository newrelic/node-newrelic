'use strict'

var helper = require('../../lib/agent_helper')
var tap = require('tap')
var tests = require('../../lib/cross_agent_tests/attribute_configuration')

tap.test('Attribute include/exclude configurations', function(t) {
  t.plan(tests.length)

  tests.forEach(function(test) {
    runTest(t, test)
  })
})

function runTest(t, test) {
  // Load the agent and set the test configuration as if from the server.
  // We don't actually need the agent, so unload it immediately after.
  var agent = helper.loadMockedAgent(null, {attributes: {enabled: true}})
  agent.config.onConnect(test.config)
  helper.unloadAgent(agent)

  // Filter the destinations.
  var destinations = test.input_default_destinations.filter(function(dest) {
    return agent.config.attributeFilter.test(dest, test.input_key)
  })

  // Did we pass?
  var passed = t.deepEqual(destinations, test.expected_destinations, test.testname)

  // If not, log the test information to make debugging easier.
  if (!passed) {
    t.comment(JSON.stringify({
      input: test.config,
      key: test.input_key,
      ___: '___',
      attrs: agent.config.attributes,
      trace_attrs: agent.config.transaction_tracer.attributes,
      tx_event_attrs: agent.config.transaction_events.attributes,
      error_attrs: agent.config.error_collector.attributes,
      browser_attrs: agent.config.browser_monitoring.attributes
    }, null, 2))
  }
}
