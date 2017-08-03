'use strict'
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
    txn.end(t.end)
  })
})

test('promise hooks', function(t) {
  var testMetrics = {
    initCalled: 0,
    beforeCalled: 0,
    afterCalled: 0,
    destroyCalled: 0
  }
  asyncHooks.createHook({
    init: function initHook(id, type, triggerAsyncId) {
    },
    before: function beforeHook(id) {
    },
    after: function afterHook(id) {
    },
    destroy: function destHook(id) {
    }
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
