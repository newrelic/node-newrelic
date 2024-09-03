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

function expectEntry(entry, msg, level, keys) {
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
      expectEntry(results[0], '1: a', 30)
      expectEntry(results[1], '123 4 5', 30)
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
      expectEntry(results[0], '1: a', 30, keys)
      assert.equal(results[0].a, 1)
      assert.equal(results[0].b, 2)
      expectEntry(results[1], '123 4 5', 30, keys)
      assert.equal(results[1].a, 1)
      assert.equal(results[1].b, 2)
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
      expectEntry(results[0], 'info', 30)
      expectEntry(results[1], 'warn', 40)
      expectEntry(results[2], 'error', 50)
      expectEntry(results[3], 'fatal', 60)

      logger.level('trace')
      logger.trace('trace')
      logger.debug('debug')
      ;({ results } = t.nr)
      assert.equal(results.length, 6)
      expectEntry(results[4], 'trace', 10)
      expectEntry(results[5], 'debug', 20)
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
      expectEntry(results[0], 'info', 30, ['aChild'].concat(DEFAULT_KEYS))
      expectEntry(results[1], 'warn', 40, ['aChild'].concat(DEFAULT_KEYS))
      expectEntry(results[2], 'error', 50, ['aChild'].concat(DEFAULT_KEYS))
      expectEntry(results[3], 'fatal', 60, ['aChild'].concat(DEFAULT_KEYS))
      expectEntry(results[4], 'info', 30, ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS))
      expectEntry(results[5], 'warn', 40, ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS))
      expectEntry(results[6], 'error', 50, ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS))
      expectEntry(results[7], 'fatal', 60, ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS))

      logger.level('trace')
      child.trace('trace')
      grandchild.debug('debug')
      ;({ results } = t.nr)
      assert.equal(results.length, 10)
      expectEntry(results[8], 'trace', 10, ['aChild'].concat(DEFAULT_KEYS))
      expectEntry(results[9], 'debug', 20, ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS))
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
      expectEntry(results[1], 'hello b', 30, ['b', 'c'].concat(DEFAULT_KEYS))
      assert.equal(results[1].b, 5)
      assert.equal(results[1].c, 3)

      expectEntry(results[2], 'hello c', 30, ['a', 'b', 'c'].concat(DEFAULT_KEYS))
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
        expectEntry(results[0], 'value', 30, DEFAULT_KEYS)
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
      expectEntry(results[0], 'info', 30, DEFAULT_KEYS)
      expectEntry(results[1], 'another', 30, DEFAULT_KEYS)
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
      expectEntry(results[0], 'hello a', 30, ['a'].concat(DEFAULT_KEYS))
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
        expectEntry(results[0], 'value', 30, DEFAULT_KEYS)
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
          expectEntry(results[0], 'value', 30, DEFAULT_KEYS)
          expectEntry(results[1], 'value', 30, DEFAULT_KEYS)
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
      expectEntry(results[0], 'hello a', 30, ['a'].concat(DEFAULT_KEYS))
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
      expectEntry(results[0], 'JSON: {"a":1,"b":2,"self":"[Circular ~]"}', 30)
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
      expectEntry(results[0], 'JSON: [UNPARSABLE OBJECT]', 30)
      end()
    })
  })
})

test('logger write queue should buffer writes', function (t, end) {
  const bigString = new Array(16 * 1024).join('a')

  const logger = new Logger({
    name: 'my-logger',
    level: 'info',
    hostname: 'my-host'
  })

  logger.once('readable', function () {
    logger.push = function (str) {
      const pushed = Logger.prototype.push.call(this, str)
      if (pushed) {
        const parts = str
          .split('\n')
          .filter(Boolean)
          .map(function (a) {
            return a.toString()
          })
          .map(JSON.parse)
        expectEntry(parts[0], 'b', 30)
        expectEntry(parts[1], 'c', 30)
        expectEntry(parts[2], 'd', 30)
      }

      return pushed
    }

    logger.info('b')
    logger.info('c')
    logger.info('d')

    logger.read()

    process.nextTick(function () {
      end()
    })
  })
  logger.info(bigString)
})
