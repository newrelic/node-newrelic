/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const cp = require('node:child_process')

const tempRemoveListeners = require('../lib/temp-remove-listeners')

const Logger = require('../../lib/util/logger')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.logger = new Logger({
    name: 'newrelic',
    level: 'trace',
    enabled: true,
    configured: true
  })
})

test('should not throw when passed-in log level is 0', (t) => {
  const { logger } = t.nr
  assert.doesNotThrow(() => {
    logger.level(0)
  })
})

test('should not throw when passed-in log level is ONE MILLION', (t) => {
  const { logger } = t.nr
  assert.doesNotThrow(function () {
    logger.level(1000000)
  })
})

test('should not throw when passed-in log level is "verbose"', (t) => {
  const { logger } = t.nr
  assert.doesNotThrow(function () {
    logger.level('verbose')
  })
})

test('should enqueue logs until configured', (t) => {
  const { logger } = t.nr
  logger.options.configured = false
  logger.trace('trace')
  logger.debug('debug')
  logger.info('info')
  logger.warn('warn')
  logger.error('error')
  logger.fatal('fatal')
  assert.ok(logger.logQueue.length === 6, 'should have 6 logs in the queue')
})

test('should not enqueue logs when disabled', (t) => {
  const { logger } = t.nr
  logger.trace('trace')
  logger.debug('debug')
  logger.info('info')
  logger.warn('warn')
  logger.error('error')
  logger.fatal('fatal')
  assert.ok(logger.logQueue.length === 0, 'should have 0 logs in the queue')
})

test('should flush logs when configured', (t) => {
  const { logger } = t.nr
  logger.options.configured = false
  logger.trace('trace')
  logger.debug('debug')
  logger.info('info')
  logger.warn('warn')
  logger.error('error')
  logger.fatal('fatal')

  assert.ok(logger.logQueue.length === 6, 'should have 6 logs in the queue')

  logger.configure({
    level: 'trace',
    enabled: true,
    name: 'test-logger'
  })

  assert.ok(logger.logQueue.length === 0, 'should have 0 logs in the queue')
})

test('should fallback to default logging config when config is invalid', (t, end) => {
  runTestFile('disabled-with-invalid-config/disabled.js', function (error, message) {
    assert.equal(error, undefined)

    // should pipe logs to stdout if config is invalid, even if logging is disabled
    assert.ok(message)
    end()
  })
})

test('should not cause crash if unwritable', (t, end) => {
  runTestFile('unwritable-log/unwritable.js', end)
})

test('should not be created if logger is disabled', (t, end) => {
  runTestFile('disabled-log/disabled.js', end)
})

test('should not log bootstrapping logs when logs disabled', (t, end) => {
  runTestFile('disabled-with-log-queue/disabled.js', function (error, message) {
    assert.equal(error, undefined)
    assert.equal(message, undefined)
    end()
  })
})

test('should log bootstrapping logs at specified level when logs enabled', (t, end) => {
  runTestFile('enabled-with-log-queue/enabled.js', function (error, message) {
    assert.equal(error, undefined)
    assert.ok(message)

    let logs = []
    assert.doesNotThrow(function () {
      logs = message.split('\n').filter(Boolean).map(JSON.parse)
    })

    assert.ok(logs.length >= 1)
    assert.ok(logs.every((log) => log.level >= 30))

    end()
  })
})

test('should not throw for huge messages', (t, end) => {
  const { logger } = t.nr

  tempRemoveListeners({ t, emitter: process, event: 'warning' })
  process.once('warning', (warning) => {
    assert.equal(warning.name, 'NewRelicWarning')
    assert.ok(warning.message)
    end()
  })

  let huge = 'a'
  while (huge.length < Logger.MAX_LOG_BUFFER / 2) {
    huge += huge
  }

  try {
    logger.fatal('some message to start the buffer off')
    logger.fatal(huge)
    logger.fatal(huge)
  } catch (error) {
    assert.ifError(error)
  }
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
