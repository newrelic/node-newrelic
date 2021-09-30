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
 * to show how the result is passed throughthe segment handler.
 *
 * @param greetings
 */
async function myNextTask(greetings) {
  await new Promise((resolve) => {
    setTimeout(resolve, 1)
  })
  return `${greetings}, it's me!`
}

/**
 * This task will be run as its own segment within our transaction handler
 */
async function someTask() {
  const result = await myAsyncTask()
  const output = await myNextTask(result)
  return output
}

// Segments can only be created inside of transactions. They could be automatically
// generated HTTP transactions or custom transactions.
newrelic.startBackgroundTransaction('bg-tx', async function transHandler() {
  // `startSegment()` takes a segment name, a boolean if a metric should be
  // created for this segment, the handler function, and an optional callback.
  // The handler is the function that will be wrapped with the new segment.
  // Since `async` functions just return a promise, they are covered just the
  // same as the promise example.

  const output = await newrelic.startSegment('myCustomSegment', false, someTask)
  console.log(output)
})
