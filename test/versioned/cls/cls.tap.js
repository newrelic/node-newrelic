'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')

test('transaction state', function(t) {
  t.plan(1)

  t.test('should be preserved over timers regardless of order required', function(t) {
    require('continuation-local-storage')
    var agent = setupAgent(t)
    helper.runInTransaction(agent, function inTransaction(txn) {
      setTimeout(function() {
        t.equal(agent.getTransaction(), txn, 'should maintain tx state')
        t.end()
      }, 0)
    })
  })
})

function setupAgent(t, enableSegments) {
  var agent = helper.instrumentMockedAgent({
    feature_flag: {promise_segments: enableSegments}
  })
  t.tearDown(function tearDown() {
    helper.unloadAgent(agent)
  })
  return agent
}
