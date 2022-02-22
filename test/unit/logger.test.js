/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const cp = require('child_process')
const Logger = require('../../lib/util/logger')
const path = require('path')

tap.test('Logger', function (t) {
  t.autoend()
  let logger = null

  t.beforeEach(function () {
    logger = new Logger({
      name: 'newrelic',
      level: 'trace',
      enabled: true
    })
  })

  t.afterEach(function () {
    logger = null
  })

  t.test('should not throw when passed-in log level is 0', function (t) {
    t.doesNotThrow(function () {
      logger.level(0)
    })
    t.end()
  })

  t.test('should not throw when passed-in log level is ONE MILLION', function (t) {
    t.doesNotThrow(function () {
      logger.level(1000000)
    })
    t.end()
  })

  t.test('should not throw when passed-in log level is "verbose"', function (t) {
    t.doesNotThrow(function () {
      logger.level('verbose')
    })
    t.end()
  })

  t.test('should not cause crash if unwritable', function (t) {
    runTestFile('unwritable-log/unwritable.js', t.end)
  })

  t.test('should not be created if logger is disabled', function (t) {
    runTestFile('disabled-log/disabled.js', t.end)
  })

  t.test('should not log bootstrapping logs when logs disabled', function (t) {
    runTestFile('disabled-with-log-queue/disabled.js', function (error, message) {
      t.notOk(error)
      t.notOk(message)
      t.end()
    })
  })

  t.test('should log bootstrapping logs at specified level when logs enabled', function (t) {
    runTestFile('enabled-with-log-queue/enabled.js', function (error, message) {
      t.notOk(error)
      t.ok(message)

      let logs = []
      t.doesNotThrow(function () {
        logs = message.split('\n').filter(Boolean).map(JSON.parse)
      })

      t.ok(logs.length >= 1)
      t.ok(logs.every((log) => log.level >= 30))

      t.end()
    })
  })

  t.test('should not throw for huge messages', function (t) {
    process.once('warning', (warning) => {
      t.equal(warning.name, 'NewRelicWarning')
      t.ok(warning.message)
      t.end()
    })

    let huge = 'a'
    while (huge.length < Logger.MAX_LOG_BUFFER / 2) {
      huge += huge
    }

    t.doesNotThrow(() => {
      logger.fatal('some message to start the buffer off')
      logger.fatal(huge)
      logger.fatal(huge)
    })
  })
})

/**
 * Runs a test file in a child process
 *
 * @param {string} file path to file
 * @param {Function} cb called when test is over
 */
function runTestFile(file, cb) {
  const testHelperDir = path.resolve(__dirname, '../helpers/')
  const proc = cp.fork(path.join(testHelperDir, file), { stdio: 'pipe' })
  let message = null

  let result = ''

  proc.stdout.on('data', function (data) {
    result += data
  })

  proc.on('message', function (msg) {
    message = msg
  })

  proc.on('exit', function () {
    if (message && message.error) {
      cb(message.error)
    } else if (result) {
      cb(null, result)
    } else {
      cb()
    }
  })
}
