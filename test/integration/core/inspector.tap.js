/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var test = require('tap').test
try {
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  var inspector = require('inspector')
} catch (e) {
  // will skip tests below
}
var helper = require('../../lib/agent_helper')
test('inspector', { skip: !inspector }, function (t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function (txn) {
    var session = new inspector.Session()
    session.connect()
    session.post('Runtime.evaluate', { expression: '2 + 2' }, function () {
      var transaction = agent.getTransaction()
      t.ok(transaction, 'should preserve transaction state')
      t.equal(transaction.id, txn.id)
      t.end()
    })
  })
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  return agent
}
