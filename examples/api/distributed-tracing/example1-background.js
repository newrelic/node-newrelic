/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const newrelic = require('newrelic')

// Give the agent some time to start up.
setTimeout(runTest, 2000)

function runTest() {
  newrelic.startWebTransaction('Custom web transaction', function() {
    // Call newrelic.getTransaction to retrieve a handle on the current transaction.
    let transactionHandle = newrelic.getTransaction()

    // Generate the payload right before creating the linked transaction.
    let headers = {}
    transactionHandle.insertDistributedTraceHeaders(headers)

    newrelic.startBackgroundTransaction('Background task', function executeTransaction() {
      let backgroundHandle = newrelic.getTransaction()
      // Link the nested transaction by accepting the payload with the background transaction's handle
      backgroundHandle.acceptDistributedTraceHeaders(headers)
      // End the transactions
      backgroundHandle.end(transactionHandle.end)
    })
  })
}
