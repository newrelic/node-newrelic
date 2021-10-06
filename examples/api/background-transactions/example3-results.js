/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const newrelic = require('newrelic')

const transactionName = 'myCustomTransaction'

// The return value of the handle is passed back from `startBackgroundTransaction`.
const result = newrelic.startBackgroundTransaction(transactionName, function handle() {
  return 42
})

console.log(result) // Prints "42"
