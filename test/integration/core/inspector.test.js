/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
// eslint-disable-next-line node/no-unsupported-features/node-builtins
const inspector = require('inspector')
const helper = require('../../lib/agent_helper')

test('inspector', function (t, end) {
  const agent = helper.instrumentMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  helper.runInTransaction(agent, function (txn) {
    const session = new inspector.Session()
    session.connect()
    session.post('Runtime.evaluate', { expression: '2 + 2' }, function () {
      const transaction = agent.getTransaction()
      assert.ok(transaction, 'should preserve transaction state')
      assert.equal(transaction.id, txn.id)
      end()
    })
  })
})
