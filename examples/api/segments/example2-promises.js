/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const newrelic = require('newrelic')

/**
 * We'll stub out an async task that runs as part of monitoring a segment
 */
async function myAsyncTask() {
  await new Promise((resolve) => {
    setTimeout(resolve, 1)
  })
  return 'hello world'
}

/**
 * Then we stub out the task that handles that task's result,
 * to show how the result is passed throughthe segment handler
 *
 * @param greetings
 */
function myNextTask(greetings) {
  return `${greetings}, it's me!`
}

/**
 * This task will be run as its own segment within our transaction handler
 */
function someTask() {
  return myAsyncTask().then(function thenNext(result) {
    return myNextTask(result)
  })
}

// Segments can only be created inside of transactions. They could be automatically
// generated HTTP transactions or custom transactions.
newrelic.startBackgroundTransaction('bg-tx', function transHandler() {
  const tx = newrelic.getTransaction()

  // `startSegment()` takes a segment name, a boolean if a metric should be
  // created for this segment, the handler function, and an optional callback.
  // The handler is the function that will be wrapped with the new segment. If
  // a promise is returned from the handler, the segment's ending will be tied
  // to that promise resolving or rejecting.

  return newrelic.startSegment('myCustomSegment', false, someTask).then(function thenAfter(output) {
    console.log(output) // "hello world, it's me!"
    tx.end()
  })
})
