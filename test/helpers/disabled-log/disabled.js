/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Start with a clean slate.
const fs = require('fs')
const testLogPath = __dirname + '/test.log'
if (fs.existsSync(testLogPath)) {
  fs.unlinkSync(testLogPath)
}

// Prepare to receive any error.
process.on('uncaughtException', function (err) {
  process.send({ error: err, stack: err.stack })
})

// Load up newrelic
process.env.NEW_RELIC_HOME = __dirname
require('../../../index') // require('newrelic')

// Wait a bit then check for the file.
setTimeout(function () {
  if (fs.existsSync(testLogPath)) {
    fs.unlinkSync(testLogPath)
    process.send({ error: 'log file was created' })
  }

  process.exit(0)
}, 100)
