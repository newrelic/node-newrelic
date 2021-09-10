/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
try {
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  var inspector = require('inspector')
} catch (e) {
  // will skip tests below
}
const helper = require('../../lib/agent_helper')
test('inspector', { skip: !inspector }, function (t) {
  const agent = setupAgent(t)
  helper.runInTransaction(agent, function (txn) {
    const session = new inspector.Session()
    session.connect()
    session.post('Runtime.evaluate', { expression: '2 + 2' }, function () {
      const transaction = agent.getTransaction()
      t.ok(transaction, 'should preserve transaction state')
      t.equal(transaction.id, txn.id)
      t.end()
    })
  })
})

function setupAgent(t) {
  const agent = helper.instrumentMockedAgent()
  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  return agent
}
