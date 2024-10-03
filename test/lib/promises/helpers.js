/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function runMultiple(count, fn, cb) {
  let finished = 0
  for (let i = 0; i < count; ++i) {
    fn(i, function runMultipleCallback() {
      if (++finished >= count) {
        cb()
      }
    })
  }
}

function checkTransaction(plan, agent, transaction) {
  const currentTransaction = agent.getTransaction()

  if (transaction) {
    plan.ok(currentTransaction, 'should be in a transaction')
    if (!currentTransaction) {
      return
    }
    plan.equal(currentTransaction.id, transaction.id, 'should be the same transaction')
  } else {
    plan.ok(!currentTransaction, 'should not be in a transaction')
    plan.ok(1) // Make test count match for both branches.
  }
}

function end(tx, cb) {
  return function () {
    if (tx) {
      tx.end()
    }
    cb()
  }
}

module.exports = {
  checkTransaction,
  end,
  runMultiple
}
