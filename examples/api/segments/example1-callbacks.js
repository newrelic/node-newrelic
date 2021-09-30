/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const newrelic = require('newrelic')

/**
 * We'll stub out an async task that runs as part of monitoring a segment
 *
 * @param callback
 */
function myAsyncTask(callback) {
  const sleep = new Promise((resolve) => {
    setTimeout(resolve, 1)
  })
  sleep.then(() => {
    callback(null, 'hello world')
  })
}

/**
 * Then we stub out the task that handles that task's result,
 * to show how the result is passed throughthe segment handler
 *
 * @param greetings
 * @param callback
 */
function myNextTask(greetings, callback) {
  callback(null, `${greetings}, it's me!`)
}

/**
 * This task will be run as its own segment within our transaction handler
 *
 * @param callback
 */
function someTask(callback) {
  myAsyncTask(function firstCb(err1, result) {
    if (err1) {
      return callback(err1)
    }

    myNextTask(result, function secondCb(err2, output) {
      callback(err2, output)
    })
  })
}

// Segments can only be created inside of transactions. They could be automatically
// generated HTTP transactions or custom transactions.
newrelic.startBackgroundTransaction('bg-tx', function transHandler() {
  const tx = newrelic.getTransaction()

  // `startSegment()` takes a segment name, a boolean if a metric should be
  // created for this segment, the handler function, and an optional callback.
  // The handler is the function that will be wrapped with the new segment. When
  // a callback is provided, the segment timing will end when the callback is
  // called.

  newrelic.startSegment('myCustomSegment', false, someTask, function cb(err, output) {
    // Handle the error and output as appropriate.
    console.log(output) // "hello world, it's me!"
    tx.end()
  })
})
