/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const Logger = require('../../../lib/util/logger')
const { Transform } = require('stream')
const DEFAULT_KEYS = ['hostname', 'level', 'msg', 'name', 'pid', 'time', 'v']

tap.Test.prototype.addAssert('expectEntry', 4, function expectEntry(entry, msg, level, keys) {
  this.equal(entry.hostname, 'my-host')
  this.equal(entry.name, 'my-logger')
  this.equal(entry.pid, process.pid)
  this.equal(entry.v, 0)
  this.equal(entry.level, level)
  this.equal(entry.msg, msg)
  this.same(Object.keys(entry).sort(), keys || DEFAULT_KEYS)
})

tap.test('logger', function (t) {
  t.autoend()
  let results
  let logger

  t.beforeEach(function () {
    results = []
    logger = new Logger({
      name: 'my-logger',
      level: 'info',
      hostname: 'my-host',
      stream: new Transform({
        transform: addResult
      })
    })
  })

  function addResult(data, encoding, done) {
    results = results.concat(data.toString().split('\n').filter(Boolean).map(JSON.parse))
    done()
  }

  t.test('should interpolate values', function (t) {
    logger.info('%d: %s', 1, 'a')
    logger.info('123', 4, '5')
    process.nextTick(function () {
      t.equal(results.length, 2)
      t.expectEntry(results[0], '1: a', 30)
      t.expectEntry(results[1], '123 4 5', 30)
      t.end()
    })
  })

  t.test('should default to error level logging', function (t) {
    logger.level('donkey kong')
    t.equal(logger.options._level, 50)
    t.end()
  })

  t.test('should support prepended extras', function (t) {
    logger.info({ a: 1, b: 2 }, '%d: %s', 1, 'a')
    logger.info({ a: 1, b: 2 }, '123', 4, '5')
    process.nextTick(function () {
      const keys = ['a', 'b'].concat(DEFAULT_KEYS)
      t.equal(results.length, 2)
      t.expectEntry(results[0], '1: a', 30, keys)
      t.equal(results[0].a, 1)
      t.equal(results[0].b, 2)
      t.expectEntry(results[1], '123 4 5', 30, keys)
      t.equal(results[1].a, 1)
      t.equal(results[1].b, 2)
      t.end()
    })
  })

  t.test('should support prepended extras from Error objects', function (t) {
    const error = new Error('error1')
    t.ok(error.message)
    t.ok(error.stack)

    logger.info(error, 'log message')
    process.nextTick(function () {
      const [log1] = results
      t.equal(log1.message, error.message)
      t.equal(log1.stack, error.stack)
      t.end()
    })
  })

  t.test('should only log expected levels', function (t) {
    logger.trace('trace')
    logger.debug('debug')
    logger.info('info')
    logger.warn('warn')
    logger.error('error')
    logger.fatal('fatal')
    process.nextTick(function () {
      t.equal(results.length, 4)
      t.expectEntry(results[0], 'info', 30)
      t.expectEntry(results[1], 'warn', 40)
      t.expectEntry(results[2], 'error', 50)
      t.expectEntry(results[3], 'fatal', 60)

      logger.level('trace')
      logger.trace('trace')
      logger.debug('debug')
      t.equal(results.length, 6)
      t.expectEntry(results[4], 'trace', 10)
      t.expectEntry(results[5], 'debug', 20)
      t.end()
    })
  })

  t.test('and its children should only log expected levels', function (t) {
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
      t.equal(results.length, 8)
      t.expectEntry(results[0], 'info', 30, ['aChild'].concat(DEFAULT_KEYS))
      t.expectEntry(results[1], 'warn', 40, ['aChild'].concat(DEFAULT_KEYS))
      t.expectEntry(results[2], 'error', 50, ['aChild'].concat(DEFAULT_KEYS))
      t.expectEntry(results[3], 'fatal', 60, ['aChild'].concat(DEFAULT_KEYS))
      t.expectEntry(results[4], 'info', 30, ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS))
      t.expectEntry(results[5], 'warn', 40, ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS))
      t.expectEntry(results[6], 'error', 50, ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS))
      t.expectEntry(results[7], 'fatal', 60, ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS))

      logger.level('trace')
      child.trace('trace')
      grandchild.debug('debug')
      t.equal(results.length, 10)
      t.expectEntry(results[8], 'trace', 10, ['aChild'].concat(DEFAULT_KEYS))
      t.expectEntry(results[9], 'debug', 20, ['aChild', 'aGrandchild'].concat(DEFAULT_KEYS))
      t.end()
    })
  })

  t.test('and its children should be togglable', function (t) {
    const child = logger.child({ aChild: true })
    const grandchild = child.child({ aGrandchild: true })

    logger.info('on')
    child.info('on')
    grandchild.info('on')
    logger.setEnabled(false)
    process.nextTick(function () {
      t.equal(results.length, 3)
      logger.info('off')
      child.info('off')
      grandchild.info('off')
      t.equal(results.length, 3)
      t.end()
    })
  })

  t.test('state should be synced between parent and child', function (t) {
    const child = logger.child({ aChild: true })
    const grandchild = child.child({ aGrandchild: true })

    logger.info('on')
    child.info('on')
    grandchild.info('on')
    child.setEnabled(false)
    process.nextTick(function () {
      t.equal(results.length, 3)
      logger.info('off')
      child.info('off')
      grandchild.info('off')
      t.equal(results.length, 3)
      t.end()
    })
  })

  t.test('state should work on arbitrarily deep child loggers', function (t) {
    const child = logger.child({ aChild: true })
    const grandchild = child.child({ aGrandchild: true })

    logger.info('on')
    child.info('on')
    grandchild.info('on')
    grandchild.setEnabled(false)
    process.nextTick(function () {
      t.equal(results.length, 3)
      logger.info('off')
      child.info('off')
      grandchild.info('off')
      t.equal(results.length, 3)
      t.end()
    })
  })

  t.test('should support child loggers', function (t) {
    const childA = logger.child({ a: 1 })
    const childB = logger.child({ b: 2, c: 3 })
    const childC = childB.child({ c: 6 })
    childA.info('hello a')
    childB.info({ b: 5 }, 'hello b')
    childC.info({ a: 10 }, 'hello c')

    process.nextTick(function () {
      t.equal(results.length, 3)
      t.equal(results[0].a, 1)
      t.expectEntry(results[1], 'hello b', 30, ['b', 'c'].concat(DEFAULT_KEYS))
      t.equal(results[1].b, 5)
      t.equal(results[1].c, 3)

      t.expectEntry(results[2], 'hello c', 30, ['a', 'b', 'c'].concat(DEFAULT_KEYS))
      t.equal(results[2].a, 10)
      t.equal(results[2].b, 2)
      t.equal(results[2].c, 6)
      t.end()
    })
  })

  t.test('should support child loggers with prepended extras from Error objects', function (t) {
    const error = new Error('error1')
    t.ok(error.message)
    t.ok(error.stack)

    const child = logger.child({ a: 1 })
    child.info(error, 'log message')

    process.nextTick(function () {
      const [log1] = results
      t.equal(log1.message, error.message)
      t.equal(log1.stack, error.stack)
      t.end()
    })
  })

  t.test('should have once methods that respect log levels', function (t) {
    logger.level('info')
    logger.traceOnce('test', 'value')
    process.nextTick(function () {
      t.equal(results.length, 0)
      logger.infoOnce('test', 'value')
      process.nextTick(function () {
        t.equal(results.length, 1)
        t.expectEntry(results[0], 'value', 30, DEFAULT_KEYS)
        t.end()
      })
    })
  })

  t.test('should have once methods that log things once', function (t) {
    logger.infoOnce('testkey', 'info')
    logger.infoOnce('testkey', 'info')
    logger.infoOnce('anothertestkey', 'another')

    process.nextTick(function () {
      t.equal(results.length, 2)
      t.expectEntry(results[0], 'info', 30, DEFAULT_KEYS)
      t.expectEntry(results[1], 'another', 30, DEFAULT_KEYS)
      t.end()
    })
  })

  t.test('should have once methods that can handle objects', function (t) {
    logger.infoOnce('a', { a: 2 }, 'hello a')
    logger.infoOnce('a', { a: 2 }, 'hello c')

    process.nextTick(function () {
      t.equal(results.length, 1)
      t.equal(results[0].a, 2)
      t.expectEntry(results[0], 'hello a', 30, ['a'].concat(DEFAULT_KEYS))
      t.end()
    })
  })

  t.test('should have oncePer methods that respect log levels', function (t) {
    logger.level('info')
    logger.traceOncePer('test', 30, 'value')
    process.nextTick(function () {
      t.equal(results.length, 0)
      logger.infoOncePer('test', 30, 'value')
      process.nextTick(function () {
        t.equal(results.length, 1)
        t.expectEntry(results[0], 'value', 30, DEFAULT_KEYS)
        t.end()
      })
    })
  })

  t.test('should have oncePer methods that log things at most once in an interval', function (t) {
    logger.infoOncePer('key', 50, 'value')
    logger.infoOncePer('key', 50, 'value')
    setTimeout(function () {
      logger.infoOncePer('key', 50, 'value')
      process.nextTick(function () {
        t.equal(results.length, 2)
        t.expectEntry(results[0], 'value', 30, DEFAULT_KEYS)
        t.expectEntry(results[1], 'value', 30, DEFAULT_KEYS)
        t.end()
      })
    }, 100)
  })
  t.test('should have oncePer methods that can handle objects', function (t) {
    logger.infoOncePer('a', 10, { a: 2 }, 'hello a')

    process.nextTick(function () {
      t.equal(results.length, 1)
      t.equal(results[0].a, 2)
      t.expectEntry(results[0], 'hello a', 30, ['a'].concat(DEFAULT_KEYS))
      t.end()
    })
  })

  t.test('should have enabled methods that respect log levels', function (t) {
    logger.level('info')
    t.notOk(logger.traceEnabled())
    t.notOk(logger.debugEnabled())
    t.ok(logger.infoEnabled())
    t.ok(logger.warnEnabled())
    t.ok(logger.errorEnabled())
    t.ok(logger.fatalEnabled())
    t.end()
  })

  t.test('should have enabled methods that change with the log level', function (t) {
    logger.level('fatal')
    t.notOk(logger.traceEnabled())
    t.notOk(logger.debugEnabled())
    t.notOk(logger.infoEnabled())
    t.notOk(logger.warnEnabled())
    t.notOk(logger.errorEnabled())
    t.ok(logger.fatalEnabled())

    logger.level('trace')
    t.ok(logger.traceEnabled())
    t.ok(logger.debugEnabled())
    t.ok(logger.infoEnabled())
    t.ok(logger.warnEnabled())
    t.ok(logger.errorEnabled())
    t.ok(logger.fatalEnabled())
    t.end()
  })

  t.test('should stringify objects', function (t) {
    const obj = { a: 1, b: 2 }
    obj.self = obj
    logger.info('JSON: %s', obj)
    process.nextTick(function () {
      t.equal(results.length, 1)
      t.expectEntry(results[0], 'JSON: {"a":1,"b":2,"self":"[Circular ~]"}', 30)
      t.end()
    })
  })

  t.test('fail gracefully on unstringifiable objects', function (t) {
    const badObj = {
      get testData() {
        throw new Error()
      }
    }
    logger.info('JSON: %s', badObj)
    process.nextTick(function () {
      t.equal(results.length, 1)
      t.expectEntry(results[0], 'JSON: [UNPARSABLE OBJECT]', 30)
      t.end()
    })
  })
})

tap.test('logger write queue', function (t) {
  t.autoend()
  t.test('should buffer writes', function (t) {
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
          t.expectEntry(parts[0], 'b', 30)
          t.expectEntry(parts[1], 'c', 30)
          t.expectEntry(parts[2], 'd', 30)
        }

        return pushed
      }

      logger.info('b')
      logger.info('c')
      logger.info('d')

      logger.read()

      process.nextTick(function () {
        t.end()
      })
    })
    logger.info(bigString)
  })
})
