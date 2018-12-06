'use strict'

var test = require('tap').test
try {
  var inspector = require('inspector')
} catch (e) {
  console.log("inspector failed to load, skipping tests", e)
  return
}
var helper = require('../../lib/agent_helper')

test('inspector', function(t) {
  if (!inspector) {
    return t.end()
  }
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function(txn) {
    var session = new inspector.Session()
    session.connect()
    session.post(
      'Runtime.evaluate',
      { expression: '2 + 2' },
      function() {
        var transaction = agent.getTransaction()
        t.ok(transaction, 'should preserve transaction state')
        t.equal(transaction.id, txn.id)
        t.end()
      }
    )
  })
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })

  return agent
}
