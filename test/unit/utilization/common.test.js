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
      // We use separate paths, each with a delay that is decisively on one side
      // of its request timeout, so the outcome does not depend on fragile
      // millisecond margins. Short timeouts of 150-200ms, which is reliable on
      // a developer machine, are flaky on a contended runner like GitHub
      // Actions.

      // `/success` responds slowly (500ms) but well within its 2000ms request
      // timeout. This still exercises the "slow response" behavior the success
      // test cares about -- the client must accept a slow response and must not
      // treat it as a timeout -- without racing the timeout.
      nock('http://fakedomain').persist().get('/success').delay(500).reply(200, 'woohoo')

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
      // The response is slow (500ms) but comfortably within the 2000ms request
      // timeout. The client must accept the slow response and must not let the
      // socket timeout fire and invoke the callback a second time (which would
      // look like a spurious retry).
      common.request(
        {
          method: 'GET',
          host: 'fakedomain',
          timeout: 2000,
          path: '/success'
        },
        agent,
        (err, data) => {
          assert.ifError(err)
          assert.equal(data, 'woohoo')
          invocationCount++
        }
      )

      // Verify well after the slow response has arrived (>500ms) so a stray
      // second invocation would be observed before we assert. The margins are
      // wide enough (500ms response, 2000ms timeout, 1000ms observation) that
      // event-loop contention does not invalidate the test.
      setTimeout(verifyInvocations, 1000)

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
