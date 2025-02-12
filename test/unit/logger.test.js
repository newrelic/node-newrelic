/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const cp = require('node:child_process')
const { Transform } = require('stream')

const tempRemoveListeners = require('../lib/temp-remove-listeners')
function expectEntry(entry, msg, level, component) {
  assert.equal(entry.hostname, 'my-host')
  assert.equal(entry.name, 'test-logger')
  assert.equal(entry.pid, process.pid)
  assert.equal(entry.v, 0)
  assert.equal(entry.level, level)
  assert.equal(entry.msg, msg)
  if (component) {
    assert.equal(entry.component, component)
  }
}

const Logger = require('../../lib/util/logger')
function addResult(ctx, data, encoding, done) {
  ctx.nr.results = ctx.nr.results.concat(
    data.toString().split('\n').filter(Boolean).map(JSON.parse)
  )
  done()
}

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.logger = new Logger({
    name: 'newrelic',
    level: 'trace',
    hostname: 'my-host',
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

test('should properly format logs and child logs when flushing', (t, end) => {
  const { logger } = t.nr
  t.nr.results = []
  logger.pipe(new Transform({
    transform: addResult.bind(this, t)
  }))
  logger.options.configured = false
  const child = logger.child({ component: 'test-child' })
  logger.trace('trace')
  logger.info('%d: %s', 1, 'a')
  logger.info('123', '4', '5')
  child.info('child-info')
  const e = new Error()
  e.name = 'Testing'
  e.message = 'Test message'
  child.trace(e, 'Test error')
  logger.configure({
    level: 'trace',
    enabled: true,
    name: 'test-logger'
  })
  child.error('Test error %d %s', 1, 'sub')
  process.nextTick(() => {
    const { results } = t.nr
    assert.equal(results.length, 6)
    expectEntry(results[0], '{"name":"Testing","message":"Test message"} Test error', 10, 'test-child')
    expectEntry(results[1], 'child-info', 30, 'test-child')
    expectEntry(results[2], '123 4 5', 30)
    expectEntry(results[3], '1: a', 30)
    expectEntry(results[4], 'trace', 10)
    expectEntry(results[5], 'Test error 1 sub', 50)
    end()
  })
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
