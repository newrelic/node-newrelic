/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const Logger = require('../../../lib/util/logger')
const { Transform } = require('stream')
const DEFAULT_KEYS = ['hostname', 'level', 'msg', 'name', 'pid', 'time', 'v']

function expectEntry({ entry, msg, level, keys }, { assert = require('node:assert') } = {}) {
  assert.equal(entry.hostname, 'my-host')
  assert.equal(entry.name, 'my-logger')
  assert.equal(entry.pid, process.pid)
  assert.equal(entry.v, 0)
  assert.equal(entry.level, level)
  assert.equal(entry.msg, msg)
  assert.deepEqual(Object.keys(entry).sort(), keys || DEFAULT_KEYS)
}

function addResult(ctx, data, encoding, done) {
  ctx.nr.results = ctx.nr.results.concat(
    data.toString().split('\n').filter(Boolean).map(JSON.parse)
  )
  done()
}

test('logger', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.results = []
    ctx.nr.logger = new Logger({
      name: 'my-logger',
      level: 'info',
      hostname: 'my-host',
      stream: new Transform({
        transform: addResult.bind(this, ctx)
      })
    })
  })

  await t.test('should interpolate values', function (t, end) {
    const { logger } = t.nr
    logger.info('%d: %s', 1, 'a')
    logger.info('123', 4, '5')
    process.nextTick(function () {
      const { results } = t.nr
      assert.equal(results.length, 2)
      expectEntry({ entry: results[0], msg: '1: a', level: 30 })
      expectEntry({ entry: results[1], msg: '123 4 5', level: 30 })
      end()
    })
  })

  await t.test('should default to error level logging', function (t) {
    const { logger } = t.nr
    logger.level('donkey kong')
    assert.equal(logger.options._level, 50)
  })

  await t.test('should support prepended extras', function (t, end) {
    const { logger } = t.nr
    logger.info({ a: 1, b: 2 }, '%d: %s', 1, 'a')
    logger.info({ a: 1, b: 2 }, '123', 4, '5')
    process.nextTick(function () {
      const { results } = t.nr
      const keys = ['a', 'b'].concat(DEFAULT_KEYS)
      assert.equal(results.length, 2)
      expectEntry({ entry: results[0], msg: '1: a', level: 30, keys })
      assert.equal(results[0].a, 1)
      assert.equal(results[0].b, 2)
      expectEntry({ entry: results[1], msg: '123 4 5', level: 30, keys })
      assert.equal(results[1].a, 1)
      assert.equal(results[1].b, 2)
      end()
    })
  })

  await t.test('should embed data under a key', function (t, end) {
    const { logger } = t.nr
    logger.info({ data: { foo: 'bar' } }, 'hello world')
    process.nextTick(() => {
      const { results } = t.nr
      assert.equal(results.length, 1)
      expectEntry({ entry: results[0], msg: 'hello world', level: 30, keys: ['data', ...DEFAULT_KEYS] })
      end()
    })
  })

  await t.test('should support prepended extras from Error objects', function (t, end) {
    const { logger } = t.nr
    const error = new Error('error1')
    assert.ok(error.message)
    assert.ok(error.stack)

    logger.info(error, 'log message')
    process.nextTick(function () {
      const { results } = t.nr
      const [log1] = results
      assert.equal(log1.message, error.message)
      assert.equal(log1.stack, error.stack)
      end()
    })
  })

  await t.test('should serialize error objects in extras', function (t, end) {
    const { logger } = t.nr
    const error = new Error('error1')
    assert.ok(error.message)
    assert.ok(error.stack)

    logger.info({ foo: 'foo', error }, 'log message')
    process.nextTick(function () {
      const { results } = t.nr
      const [log1] = results
      assert.equal(log1.foo, 'foo')
      assert.equal(log1.error.message, error.message)
      assert.equal(log1.error.stack, error.stack)
      end()
    })
  })

  await t.test('should only log expected levels', function (t, end) {
    const { logger } = t.nr
    logger.trace('trace')
    logger.debug('debug')
    logger.info('info')
    logger.warn('warn')
    logger.error('error')
    logger.fatal('fatal')
    process.nextTick(function () {
      let { results } = t.nr
      assert.equal(results.length, 4)
      expectEntry({ entry: results[0], msg: 'info', level: 30 })
      expectEntry({ entry: results[1], msg: 'warn', level: 40 })
      expectEntry({ entry: results[2], msg: 'error', level: 50 })
      expectEntry({ entry: results[3], msg: 'fatal', level: 60 })

      logger.level('trace')
      logger.trace('trace')
      logger.debug('debug')
      ;({ results } = t.nr)
      assert.equal(results.length, 6)
      expectEntry({ entry: results[4], msg: 'trace', level: 10 })
      expectEntry({ entry: results[5], msg: 'debug', level: 20 })
      end()
    })
  })

  await t.test('and its children should only log expected levels', function (t, end) {
    const { logger } = t.nr
    const child = logger.child({ aChild: true })
    const grandchild = child.child({ aGrandchild: true })

    child.trace('trace')
    child.debug('debug')
    child.info('info')
    child.warn('warn')
    child.error('error')
    child.fatal('fatal')
    grandchild.trace('trace')
    grandchild.debug('debug')
    grandchild.info('info')
    grandchild.warn('warn')
    grandchild.error('error')
    grandchild.fatal('fatal')
    process.nextTick(function () {
      let { results } = t.nr
      assert.equal(results.length, 8)
      expectEntry({ entry: results[0], msg: 'info', level: 30, keys: ['aChild'].concat(DEFAULT_KEYS) })
      expectEntry({ entry: results[1], msg: 'warn', level: 40, keys: ['aChild'].concat(DEFAULT_KEYS) })
      expectEntry({ entry: results[2], msg: 'error', level: 50, keys: ['aChild'].concat(DEFAULT_KEYS) })
      expectEntry({ entry: results[3], msg: 'fatal', level: 60, keys: ['aChild'].concat(DEFAULT_KEYS) })
      expectEntry({ entry: results[4], msg: 'info', level: 30, keys: ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS) })
      expectEntry({ entry: results[5], msg: 'warn', level: 40, keys: ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS) })
      expectEntry({ entry: results[6], msg: 'error', level: 50, keys: ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS) })
      expectEntry({ entry: results[7], msg: 'fatal', level: 60, keys: ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS) })

      logger.level('trace')
      child.trace('trace')
      grandchild.debug('debug')
      ;({ results } = t.nr)
      assert.equal(results.length, 10)
      expectEntry({ entry: results[8], msg: 'trace', level: 10, keys: ['aChild'].concat(DEFAULT_KEYS) })
      expectEntry({ entry: results[9], msg: 'debug', level: 20, keys: ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS) })
      end()
    })
  })

  await t.test('and its children should be togglable', function (t, end) {
    const { logger } = t.nr
    const child = logger.child({ aChild: true })
    const grandchild = child.child({ aGrandchild: true })

    logger.info('on')
    child.info('on')
    grandchild.info('on')
    logger.setEnabled(false)
    process.nextTick(function () {
      let { results } = t.nr
      assert.equal(results.length, 3)
      logger.info('off')
      child.info('off')
      grandchild.info('off')
      ;({ results } = t.nr)
      assert.equal(results.length, 3)
      end()
    })
  })

  await t.test('state should be synced between parent and child', function (t, end) {
    const { logger } = t.nr
    const child = logger.child({ aChild: true })
    const grandchild = child.child({ aGrandchild: true })

    logger.info('on')
    child.info('on')
    grandchild.info('on')
    child.setEnabled(false)
    process.nextTick(function () {
      let { results } = t.nr
      assert.equal(results.length, 3)
      logger.info('off')
      child.info('off')
      grandchild.info('off')
      ;({ results } = t.nr)
      assert.equal(results.length, 3)
      end()
    })
  })

  await t.test('state should work on arbitrarily deep child loggers', function (t, end) {
    const { logger } = t.nr
    const child = logger.child({ aChild: true })
    const grandchild = child.child({ aGrandchild: true })

    logger.info('on')
    child.info('on')
    grandchild.info('on')
    grandchild.setEnabled(false)
    process.nextTick(function () {
      let { results } = t.nr
      assert.equal(results.length, 3)
      logger.info('off')
      child.info('off')
      grandchild.info('off')
      ;({ results } = t.nr)
      assert.equal(results.length, 3)
      end()
    })
  })

  await t.test('should support child loggers', function (t, end) {
    const { logger } = t.nr
    const childA = logger.child({ a: 1 })
    const childB = logger.child({ b: 2, c: 3 })
    const childC = childB.child({ c: 6 })
    childA.info('hello a')
    childB.info({ b: 5 }, 'hello b')
    childC.info({ a: 10 }, 'hello c')

    process.nextTick(function () {
      const { results } = t.nr
      assert.equal(results.length, 3)
      assert.equal(results[0].a, 1)
      expectEntry({ entry: results[1], msg: 'hello b', level: 30, keys: ['b', 'c'].concat(DEFAULT_KEYS) })
      assert.equal(results[1].b, 5)
      assert.equal(results[1].c, 3)

      expectEntry({ entry: results[2], msg: 'hello c', level: 30, keys: ['a', 'b', 'c'].concat(DEFAULT_KEYS) })
      assert.equal(results[2].a, 10)
      assert.equal(results[2].b, 2)
      assert.equal(results[2].c, 6)
      end()
    })
  })

  await t.test(
    'should support child loggers with prepended extras from Error objects',
    function (t, end) {
      const { logger } = t.nr
      const error = new Error('error1')
      assert.ok(error.message)
      assert.ok(error.stack)

      const child = logger.child({ a: 1 })
      child.info(error, 'log message')

      process.nextTick(function () {
        const { results } = t.nr
        const [log1] = results
        assert.equal(log1.message, error.message)
        assert.equal(log1.stack, error.stack)
        end()
      })
    }
  )

  await t.test('should have once methods that respect log levels', function (t, end) {
    const { logger } = t.nr
    logger.level('info')
    logger.traceOnce('test', 'value')
    process.nextTick(function () {
      let { results } = t.nr
      assert.equal(results.length, 0)
      logger.infoOnce('test', 'value')
      process.nextTick(function () {
        ;({ results } = t.nr)
        assert.equal(results.length, 1)
        expectEntry({ entry: results[0], msg: 'value', level: 30, keys: DEFAULT_KEYS })
        end()
      })
    })
  })

  await t.test('should have once methods that log things once', function (t, end) {
    const { logger } = t.nr
    logger.infoOnce('testkey', 'info')
    logger.infoOnce('testkey', 'info')
    logger.infoOnce('anothertestkey', 'another')

    process.nextTick(function () {
      const { results } = t.nr
      assert.equal(results.length, 2)
      expectEntry({ entry: results[0], msg: 'info', level: 30, keys: DEFAULT_KEYS })
      expectEntry({ entry: results[1], msg: 'another', level: 30, keys: DEFAULT_KEYS })
      end()
    })
  })

  await t.test('should have once methods that can handle objects', function (t, end) {
    const { logger } = t.nr
    logger.infoOnce('a', { a: 2 }, 'hello a')
    logger.infoOnce('a', { a: 2 }, 'hello c')

    process.nextTick(function () {
      const { results } = t.nr
      assert.equal(results.length, 1)
      assert.equal(results[0].a, 2)
      expectEntry({ entry: results[0], msg: 'hello a', level: 30, keys: ['a'].concat(DEFAULT_KEYS) })
      end()
    })
  })

  await t.test('should have oncePer methods that respect log levels', function (t, end) {
    const { logger } = t.nr
    logger.level('info')
    logger.traceOncePer('test', 30, 'value')
    process.nextTick(function () {
      let { results } = t.nr
      assert.equal(results.length, 0)
      logger.infoOncePer('test', 30, 'value')
      process.nextTick(function () {
        ;({ results } = t.nr)
        assert.equal(results.length, 1)
        expectEntry({ entry: results[0], msg: 'value', level: 30, keys: DEFAULT_KEYS })
        end()
      })
    })
  })

  await t.test(
    'should have oncePer methods that log things at most once in an interval',
    function (t, end) {
      const { logger } = t.nr
      logger.infoOncePer('key', 50, 'value')
      logger.infoOncePer('key', 50, 'value')
      setTimeout(function () {
        logger.infoOncePer('key', 50, 'value')
        process.nextTick(function () {
          const { results } = t.nr
          assert.equal(results.length, 2)
          expectEntry({ entry: results[0], msg: 'value', level: 30, keys: DEFAULT_KEYS })
          expectEntry({ entry: results[1], msg: 'value', level: 30, keys: DEFAULT_KEYS })
          end()
        })
      }, 100)
    }
  )

  await t.test('should have oncePer methods that can handle objects', function (t, end) {
    const { logger } = t.nr
    logger.infoOncePer('a', 10, { a: 2 }, 'hello a')

    process.nextTick(function () {
      const { results } = t.nr
      assert.equal(results.length, 1)
      assert.equal(results[0].a, 2)
      expectEntry({ entry: results[0], msg: 'hello a', level: 30, keys: ['a'].concat(DEFAULT_KEYS) })
      end()
    })
  })

  await t.test('should have enabled methods that respect log levels', function (t) {
    const { logger } = t.nr
    logger.level('info')
    assert.ok(!logger.traceEnabled())
    assert.ok(!logger.debugEnabled())
    assert.ok(logger.infoEnabled())
    assert.ok(logger.warnEnabled())
    assert.ok(logger.errorEnabled())
    assert.ok(logger.fatalEnabled())
  })

  await t.test('should have enabled methods that change with the log level', function (t) {
    const { logger } = t.nr
    logger.level('fatal')
    assert.ok(!logger.traceEnabled())
    assert.ok(!logger.debugEnabled())
    assert.ok(!logger.infoEnabled())
    assert.ok(!logger.warnEnabled())
    assert.ok(!logger.errorEnabled())
    assert.ok(logger.fatalEnabled())

    logger.level('trace')
    assert.ok(logger.traceEnabled())
    assert.ok(logger.debugEnabled())
    assert.ok(logger.infoEnabled())
    assert.ok(logger.warnEnabled())
    assert.ok(logger.errorEnabled())
    assert.ok(logger.fatalEnabled())
  })

  await t.test('should stringify objects', function (t, end) {
    const { logger } = t.nr
    const obj = { a: 1, b: 2 }
    obj.self = obj
    logger.info('JSON: %s', obj)
    process.nextTick(function () {
      const { results } = t.nr
      assert.equal(results.length, 1)
      expectEntry({ entry: results[0], msg: 'JSON: {"a":1,"b":2,"self":"[Circular ~]"}', level: 30 })
      end()
    })
  })

  await t.test('fail gracefully on unstringifiable objects', function (t, end) {
    const { logger } = t.nr
    const badObj = {
      get testData() {
        throw new Error()
      }
    }
    logger.info('JSON: %s', badObj)
    process.nextTick(function () {
      const { results } = t.nr
      assert.equal(results.length, 1)
      expectEntry({ entry: results[0], msg: 'JSON: [UNPARSABLE OBJECT]', level: 30 })
      end()
    })
  })
})

test('logger write queue should buffer writes', function (t, end) {
  t.plan(21)
  const bigString = new Array(16 * 1024).join('a')

  const logger = new Logger({
    name: 'my-logger',
    level: 'info',
    hostname: 'my-host'
  })

  const logEntries = ['b', 'c', 'd']
  const queuedStrings = []
  logger.once('readable', function () {
    logger.push = function (str) {
      const pushed = Logger.prototype.push.call(this, str)
      if (pushed) {
        queuedStrings.push(str)
      }
      return pushed
    }

    for (const entry of logEntries) {
      logger.info(entry)
    }

    logger.read()
    for (let i = 0; i < queuedStrings.length; i++) {
      const entry = queuedStrings[i]
      expectEntry({ entry: JSON.parse(entry), msg: logEntries[i], level: 30 }, { assert: t.assert })
    }
    end()
  })
  logger.info(bigString)
})
