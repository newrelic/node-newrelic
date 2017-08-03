'use strict'
var semver = require('semver')

if (semver.satisfies(process.version, "<8")) {
  console.log('async hooks are not supported in node version: ' + process.version)
  return
}

var test = require('tap').test
var helper = require('../../lib/agent_helper')
var asyncHooks = require('async_hooks')

test('await', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, async function(txn) {
    var transaction = agent.getTransaction()
    t.equal(transaction && transaction.id, txn.id)
    await Promise.resolve("i'll be back")
    transaction = agent.getTransaction()
    t.equal(transaction && transaction.id, txn.id)
    txn.end(t.end.bind(t))
  })
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent({
    await_support: true
  })
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })

  return agent
}
