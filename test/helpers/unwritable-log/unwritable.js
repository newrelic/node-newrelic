/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Create a bad log file.
const fs = require('node:fs')
const path = require('node:path')

const testLogPath = path.join(__dirname, 'test.log')
const readOnlyMode = 0x100 // => 0400 => r - -
if (!fs.existsSync(testLogPath)) {
  fs.openSync(testLogPath, 'w', readOnlyMode)
}
fs.chmodSync(testLogPath, readOnlyMode)

// Prepare to receive the error.
process.on('uncaughtException', function (err) {
  process.send({ error: err, stack: err.stack })
})

// Load up new relic with the bad file.
try {
  process.env.NEW_RELIC_HOME = __dirname
  require('../../../index') // require('newrelic')
} catch (err) {
  process.send({ error: err, stack: err.stack })
}

// Wait a bit then clean up and exit.
setTimeout(function () {
  fs.chmodSync(testLogPath, 0x180) // => 0600 => rw - -
  fs.unlinkSync(testLogPath)
  process.exit(0)
}, 100)
