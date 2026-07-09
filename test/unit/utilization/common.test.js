/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const common = require('../../../lib/utilization/common')
const helper = require('../../lib/agent_helper.js')
const nock = require('nock')

let BIG = 'abcd'
while (BIG.length < 300) {
  BIG += BIG
}

test('Utilization Common Components', async function (t) {
  await t.test('common.checkValueString', async function (t) {
    await t.test('should fail for strings of invalid size', function () {
      assert.ok(!common.checkValueString(null))
      assert.ok(!common.checkValueString({}))
      assert.ok(!common.checkValueString(''))

      assert.ok(!common.checkValueString(BIG))
    })

    await t.test('should fail for strings with invalid characters', function () {
      assert.ok(!common.checkValueString('&'))
      assert.ok(!common.checkValueString('foo\0'))
    })

    await t.test('should allow good values', function () {
      assert.ok(common.checkValueString('foobar'))
      assert.ok(common.checkValueString('f1B_./- \xff'))
    })
  })

  await t.test('common.getKeys', async function (t) {
    await t.test('should return null if any key is missing', function () {
      assert.equal(common.getKeys({}, ['foo']), null)
      assert.equal(common.getKeys({ foo: 'bar' }, ['foo', 'bar']), null)
      assert.equal(common.getKeys(null, ['foo']), null)
    })

    await t.test('should return null if any key is invalid', function () {
      assert.equal(common.getKeys({ foo: 'foo\0' }, ['foo']), null)
      assert.equal(common.getKeys({ foo: 'foo', bar: 'bar\0' }, ['foo', 'bar']), null)
    })

    await t.test('should return null if any value is too large', function () {
      assert.equal(common.getKeys({ foo: BIG }, ['foo']), null)
    })

    await t.test('should pull only the desired values', function () {
      assert.deepEqual(common.getKeys({ foo: 'foo', bar: 'bar', baz: 'baz' }, ['foo', 'baz']), {
        foo: 'foo',
        baz: 'baz'
      })
    })

    await t.test('should not fail with "clean" objects', function () {
      const obj = Object.create(null)
      obj.foo = 'foo'
      assert.deepEqual(common.getKeys(obj, ['foo']), { foo: 'foo' })
    })

    await t.test('should skip missing or invalid keys when allValuesMustBeValid is false', function () {
      // Should skip missing key 'bar' and only return valid 'foo'
      assert.deepEqual(common.getKeys({ foo: 'foo' }, ['foo', 'bar'], false), { foo: 'foo' })

      // Should skip invalid 'bar' and only return valid 'foo'
      assert.deepEqual(common.getKeys({ foo: 'foo', bar: 'bar\0' }, ['foo', 'bar'], false), { foo: 'foo' })

      // Should skip both keys if both are missing or invalid
      assert.deepEqual(common.getKeys({ baz: 'baz' }, ['foo', 'bar'], false), {})

      // Should skip key with value too large
      assert.deepEqual(common.getKeys({ foo: BIG, bar: 'bar' }, ['foo', 'bar'], false), { bar: 'bar' })
    })
  })

  await t.test('common.request', async (t) => {
    t.before(() => {
      nock.disableNetConnect()
      // Two decisive interceptors instead of one delay that races the request
      // timeout. `/success` replies immediately so the success path never times
      // out; `/timeout` delays far longer than any request timeout so the socket
      // timeout always fires first. This keeps both outcomes independent of CI
      // event-loop jitter (see NR-588003 / #4106).
      nock('http://fakedomain').persist().get('/success').reply(200, 'woohoo')
      nock('http://fakedomain').persist().get('/timeout').delay(10000).reply(200, 'woohoo')
    })

    t.beforeEach(function (ctx) {
      ctx.nr = {}
      ctx.nr.agent = helper.loadMockedAgent()
    })

    t.afterEach(function (ctx) {
      helper.unloadAgent(ctx.nr.agent)
      ctx.nr.agent = null
    })

    t.after(() => {
      nock.cleanAll()
      nock.enableNetConnect()
    })

    await t.test('should not timeout when request succeeds', (ctx, end) => {
      const agent = ctx.nr.agent
      let invocationCount = 0
      common.request(
        {
          method: 'GET',
          host: 'fakedomain',
          timeout: 1000,
          path: '/success'
        },
        agent,
        (err, data) => {
          invocationCount++
          assert.ifError(err)
          assert.equal(data, 'woohoo')
          assert.equal(invocationCount, 1, 'callback should only be invoked once')
          // Defer end() by a tick so a stray second invocation would trip the
          // assertion above rather than being missed by ending immediately.
          setImmediate(end)
        }
      )
    })

    await t.test('should not invoke callback multiple times on timeout', (ctx, end) => {
      const agent = ctx.nr.agent
      let invocationCount = 0
      common.request(
        {
          method: 'GET',
          host: 'fakedomain',
          timeout: 100,
          path: '/timeout'
        },
        agent,
        (err) => {
          invocationCount++
          assert.ok(err)
          assert.equal(err.code, 'ECONNRESET', 'error should be socket timeout')
          assert.equal(invocationCount, 1, 'callback should only be invoked once')
          // The socket timed out and aborted, but nock still has the long
          // delayed response pending; cancel it so its timer doesn't keep the
          // event loop alive for the full delay after the test passes.
          nock.abortPendingRequests()
          setImmediate(end)
        }
      )
    })
  })
})
