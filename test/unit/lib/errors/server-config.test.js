/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('#testlib/agent_helper.js')
test('Merging Server Config Values', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('onConnect should update ignore_status_codes', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      agent.config.error_collector.ignore_status_codes = [404]
      const params = { 'error_collector.ignore_status_codes': ['501-505'] }
      agent.config.onConnect(params)
      const expected = [404, 501, 502, 503, 504, 505]
      assert.deepEqual(agent.config.error_collector.ignore_status_codes, expected)
      end()
    })
  })

  await t.test('onConnect should update expected_status_codes', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      agent.config.error_collector.expected_status_codes = [404]
      const params = { 'error_collector.expected_status_codes': ['501-505'] }
      agent.config.onConnect(params)
      const expected = [404, 501, 502, 503, 504, 505]
      assert.deepEqual(agent.config.error_collector.expected_status_codes, expected)
      end()
    })
  })

  await t.test('onConnect should update expected_classes', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      agent.config.error_collector.expected_classes = ['Foo']
      const params = { 'error_collector.expected_classes': ['Bar'] }
      agent.config.onConnect(params)
      const expected = ['Foo', 'Bar']
      assert.deepEqual(agent.config.error_collector.expected_classes, expected)
      end()
    })
  })

  await t.test('onConnect should update ignore_classes', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      agent.config.error_collector.ignore_classes = ['Foo']
      const params = { 'error_collector.ignore_classes': ['Bar'] }
      agent.config.onConnect(params)
      const expected = ['Foo', 'Bar']
      assert.deepEqual(agent.config.error_collector.ignore_classes, expected)
      end()
    })
  })

  await t.test('onConnect should skip over malformed ignore_classes', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      agent.config.error_collector.ignore_classes = ['Foo']
      const params = { 'error_collector.ignore_classes': ['Bar'] }
      agent.config.onConnect(params)
      const nonsense = { 'error_collector.ignore_classes': [{ this: 'isNotAClass' }] }
      agent.config.onConnect(nonsense)
      const expected = ['Foo', 'Bar']
      assert.deepEqual(agent.config.error_collector.ignore_classes, expected)
      end()
    })
  })

  await t.test('onConnect should update expected_messages', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      agent.config.error_collector.expected_messages = { Foo: ['bar'] }
      const params = { 'error_collector.expected_messages': { Zip: ['zap'] } }
      agent.config.onConnect(params)
      const expected = { Foo: ['bar'], Zip: ['zap'] }
      assert.deepEqual(agent.config.error_collector.expected_messages, expected)
      end()
    })
  })

  await t.test('onConnect should update ignore_messages', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      agent.config.error_collector.ignore_messages = { Foo: ['bar'] }
      const params = { 'error_collector.ignore_messages': { Zip: ['zap'] } }
      agent.config.onConnect(params)
      const expected = { Foo: ['bar'], Zip: ['zap'] }
      assert.deepEqual(agent.config.error_collector.ignore_messages, expected)
      end()
    })
  })

  await t.test('onConnect should merge if keys match', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      agent.config.error_collector.ignore_messages = { Foo: ['bar'] }
      const params = { 'error_collector.ignore_messages': { Foo: ['zap'] } }
      agent.config.onConnect(params)
      const expected = { Foo: ['bar', 'zap'] }
      assert.deepEqual(agent.config.error_collector.ignore_messages, expected)
      end()
    })
  })

  await t.test('onConnect misconfigure should not explode', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      // whoops, a misconfiguration
      agent.config.error_collector.ignore_messages = { Foo: 'bar' }
      const params = { 'error_collector.ignore_messages': { Foo: ['zap'] } }
      agent.config.onConnect(params)
      const expected = { Foo: ['zap'] } // expect this to replace
      assert.deepEqual(agent.config.error_collector.ignore_messages, expected)
      end()
    })
  })

  await t.test('onConnect local misconfigure should not explode', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      // whoops, a misconfiguration
      agent.config.error_collector.ignore_messages = { Foo: 'bar' }
      const params = { 'error_collector.ignore_messages': { Foo: ['zap'] } }
      agent.config.onConnect(params)
      const expected = { Foo: ['zap'] } // expect this to replace
      assert.deepEqual(agent.config.error_collector.ignore_messages, expected)
      end()
    })
  })

  await t.test('onConnect ignore_message misconfiguration should be ignored', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      // whoops, a misconfiguration
      const badServerValues = [
        null,
        42,
        'a',
        [1, 2, 3, 4],
        { Foo: null, Bar: ['zap'] },
        { Foo: 42, Bar: ['zap'] },
        { Foo: 'a', Bar: ['zap'] }
      ]
      badServerValues.forEach(function (value) {
        const expected = { Foo: ['zap'] }
        agent.config.error_collector.ignore_messages = expected
        const params = { 'error_collector.ignore_messages': value }
        agent.config.onConnect(params)
        assert.deepEqual(agent.config.error_collector.ignore_messages, expected)
      })
      end()
    })
  })

  await t.test('onConnect expect_message misconfiguration should be ignored', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      // whoops, a misconfiguration
      const badServerValues = [
        null,
        42,
        'a',
        [1, 2, 3, 4],
        { Foo: null, Bar: ['zap'] },
        { Foo: 42, Bar: ['zap'] },
        { Foo: 'a', Bar: ['zap'] }
      ]
      badServerValues.forEach(function (value) {
        const expected = { Foo: ['zap'] }
        agent.config.error_collector.expect_messages = expected
        const params = { 'error_collector.expect_messages': value }
        agent.config.onConnect(params)
        assert.deepEqual(agent.config.error_collector.expect_messages, expected)
      })
      end()
    })
  })

  await t.test('onConnect ignore_classes misconfiguration should be ignored', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      // classes should be an array of strings
      const badServerValues = [
        null,
        42,
        'a',
        { Foo: null, Bar: ['zap'] },
        { Foo: 42, Bar: ['zap'] },
        { Foo: 'a', Bar: ['zap'] },
        { Foo: ['foo'] }
      ]
      badServerValues.forEach(function (value) {
        const expected = ['Error', 'AnotherError']
        agent.config.error_collector.ignore_classes = expected
        const params = { 'error_collector.ignore_classes': value }
        agent.config.onConnect(params)
        assert.deepEqual(agent.config.error_collector.ignore_classes, expected)
      })
      end()
    })
  })

  await t.test('onConnect expect_classes misconfiguration should be ignored', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      // classes should be an array of strings
      const badServerValues = [
        null,
        42,
        'a',
        { Foo: null, Bar: ['zap'] },
        { Foo: 42, Bar: ['zap'] },
        { Foo: 'a', Bar: ['zap'] },
        { Foo: ['foo'] }
      ]
      badServerValues.forEach(function (value) {
        const expected = ['Error', 'AnotherError']
        agent.config.error_collector.expect_classes = expected
        const params = { 'error_collector.expect_classes': value }
        agent.config.onConnect(params)
        assert.deepEqual(agent.config.error_collector.expect_classes, expected)
      })
      end()
    })
  })

  await t.test('onConnect ignore_status_codes misconfiguration should be ignored', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      // classes should be an array of strings and numbers
      const badServerValues = [
        null,
        42,
        'a',
        { Foo: null, Bar: ['zap'] },
        { Foo: 42, Bar: ['zap'] },
        { Foo: 'a', Bar: ['zap'] },
        { Foo: ['foo'] }
      ]
      badServerValues.forEach(function (value) {
        const toSet = [500, '501', '502-505']
        const expected = [500, 501, 502, 503, 504, 505]
        agent.config.error_collector.ignore_status_codes = toSet
        const params = { 'error_collector.ignore_status_codes': value }
        agent.config.onConnect(params)
        assert.deepEqual(agent.config.error_collector.ignore_status_codes, expected)
      })
      end()
    })
  })

  await t.test('onConnect expect_status_codes misconfiguration should be ignored', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      // classes should be an array of strings and numbers
      const badServerValues = [
        null,
        42,
        'a',
        { Foo: null, Bar: ['zap'] },
        { Foo: 42, Bar: ['zap'] },
        { Foo: 'a', Bar: ['zap'] },
        { Foo: ['foo'] }
      ]
      badServerValues.forEach(function (value) {
        const toSet = [500, '501', '502-505']
        const expected = [500, 501, 502, 503, 504, 505]
        agent.config.error_collector.expected_status_codes = toSet
        const params = { 'error_collector.expected_status_codes': value }
        agent.config.onConnect(params)
        assert.deepEqual(agent.config.error_collector.expected_status_codes, expected)
      })
      end()
    })
  })

  await t.test('onConnect should de-duplicate arrays nested in object', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, () => {
      // whoops, a misconfiguration
      agent.config.error_collector.ignore_messages = { Foo: ['zap', 'bar'] }
      const params = { 'error_collector.ignore_messages': { Foo: ['bar'] } }
      agent.config.onConnect(params)
      const expected = { Foo: ['zap', 'bar'] } // expect this to replace
      assert.deepEqual(agent.config.error_collector.ignore_messages, expected)
      end()
    })
  })
})
