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
      // We need separate paths for success and failure so that we do not
      // have to rely on fragile millisecond based timings. While timings of
      // 100 - 150ms works reliably on individual developer systems, they are
      // too tight on contendend systems like GitHub Actions.

      // `/success` replies immediately so the success path never times out
      nock('http://fakedomain').persist().get('/success').reply(200, 'woohoo')

      // `/timeout` delays far longer than any request timeout so the socket
      // timeout always fires first.
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
          // We set a high timeout here in order to give the request time to
          // complete on contended systems like GitHub Actions.
          timeout: 1000,
          path: '/success'
        },
        agent,
        (err, data) => {
          assert.ifError(err)
          assert.equal(data, 'woohoo')
          invocationCount++
        }
      )

      // `common.request` leaves its `timeout`/`error` socket listeners attached
      // after a successful response, so a late socket event could invoke the
      // callback a second time. Wait after the request has completed and then
      // verify it was only invoked once. This window no longer races the
      // request itself -- `/success` replies immediately -- so it is not timing
      // sensitive; it is purely an observation period for a stray second call.
      setTimeout(verifyInvocations, 250)

      function verifyInvocations() {
        assert.equal(invocationCount, 1, 'callback should only be invoked once')
        end()
      }
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
          assert.ok(err)
          assert.equal(err.code, 'ECONNRESET', 'error should be socket timeout')
          invocationCount++
          // The socket timed out and aborted, but nock still has the long
          // delayed response pending; cancel it so its timer doesn't keep the
          // event loop alive for the full delay after the test passes.
          nock.abortPendingRequests()
        }
      )

      // Wait past the request timeout and then verify the callback fired only
      // once. The window is not timing sensitive: the socket always times out
      // at 100ms (the `/timeout` response is delayed far longer), so this just
      // observes for a stray second invocation after the abort.
      setTimeout(verifyInvocations, 250)

      function verifyInvocations() {
        assert.equal(invocationCount, 1, 'callback should only be invoked once')
        end()
      }
    })
  })
})
