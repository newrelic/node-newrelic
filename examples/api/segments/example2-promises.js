/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var newrelic = require('newrelic')

// Segments can only be created inside of transactions. They could be automatically
// generated HTTP transactions or custom transactions.
newrelic.startBackgroundTransaction('bg-tx', function transHandler() {
  // `startSegment()` takes a segment name, a boolean if a metric should be
  // created for this segment, the handler function, and an optional callback.
  // The handler is the function that will be wrapped with the new segment. If
  // a promise is returned from the handler, the segment's ending will be tied
  // to that promise resolving or rejecting.

  return newrelic.startSegment('myCustomSegment', false, someTask)
    .then(function thenAfter(output) {
      console.log(output)
    })
})

function someTask() {
  return myAsyncTask().then(function thenNext(result) {
    return myNextTask(result)
  })
}
