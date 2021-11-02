/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const common = require('../../../lib/utilization/common')
const helper = require('../../lib/agent_helper.js')

let BIG = 'abcd'
while (BIG.length < 300) {
  BIG += BIG
}

tap.test('Utilization Common Components', function (t) {
  t.autoend()
  t.test('common.checkValueString', function (t) {
    t.autoend()
    t.test('should fail for strings of invalid size', function (t) {
      t.notOk(common.checkValueString(null))
      t.notOk(common.checkValueString({}))
      t.notOk(common.checkValueString(''))

      t.notOk(common.checkValueString(BIG))
      t.end()
    })

    t.test('should fail for strings with invalid characters', function (t) {
      t.notOk(common.checkValueString('&'))
      t.notOk(common.checkValueString('foo\0'))
      t.end()
    })

    t.test('should allow good values', function (t) {
      t.ok(common.checkValueString('foobar'))
      t.ok(common.checkValueString('f1B_./- \xff'))
      t.end()
    })
  })

  t.test('common.getKeys', function (t) {
    t.autoend()
    t.test('should return null if any key is missing', function (t) {
      t.equal(common.getKeys({}, ['foo']), null)
      t.equal(common.getKeys({ foo: 'bar' }, ['foo', 'bar']), null)
      t.equal(common.getKeys(null, ['foo']), null)
      t.end()
    })

    t.test('should return null if any key is invalid', function (t) {
      t.equal(common.getKeys({ foo: 'foo\0' }, ['foo']), null)
      t.equal(common.getKeys({ foo: 'foo', bar: 'bar\0' }, ['foo', 'bar']), null)
      t.end()
    })

    t.test('should return null if any value is too large', function (t) {
      t.equal(common.getKeys({ foo: BIG }, ['foo']), null)
      t.end()
    })

    t.test('should pull only the desired values', function (t) {
      t.same(common.getKeys({ foo: 'foo', bar: 'bar', baz: 'baz' }, ['foo', 'baz']), {
        foo: 'foo',
        baz: 'baz'
      })
      t.end()
    })

    t.test('should not fail with "clean" objects', function (t) {
      const obj = Object.create(null)
      obj.foo = 'foo'
      t.same(common.getKeys(obj, ['foo']), { foo: 'foo' })
      t.end()
    })
  })

  t.test('common.request', (t) => {
    t.autoend()
    let agent = null
    let clock = null

    t.beforeEach(function () {
      const sinon = require('sinon')
      clock = sinon.useFakeTimers()

      agent = helper.loadMockedAgent()
    })

    t.afterEach(function () {
      helper.unloadAgent(agent)
      agent = null

      clock.restore()
      clock = null
    })

    t.test('should not invoke callback multiple times on timeout', (t) => {
      let invocationCount = 0
      common.request(
        {
          host: 'fakedomain.provider.something',
          path: '/metadata'
        },
        agent,
        (err) => {
          invocationCount++
          t.ok(err)
        }
      )

      // trigger the timeout
      clock.tick(2000)

      // let the rest run
      clock.restore()

      // need to give enough time for second to have chance to run.
      // sinon and http dont quite seem to work well enough to do this
      // totally faked synchronously.
      setTimeout(verifyInvocations, 1000)

      function verifyInvocations() {
        t.equal(invocationCount, 1)
        t.end()
      }
    })
  })
})
