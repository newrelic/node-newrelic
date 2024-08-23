/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const SpanEvent = require('../../../lib/spans/span-event')

const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS

test('Agent API - custom attributes', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    agent.config.attributes.enabled = true
    agent.config.distributed_tracing.enabled = true

    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('exports a function for adding multiple custom attributes at once', (t, end) => {
    const { api } = t.nr
    assert.ok(api.addCustomAttributes)
    assert.equal(typeof api.addCustomAttributes, 'function')
    end()
  })

  await t.test("shouldn't blow up without a transaction", (t, end) => {
    const { api } = t.nr
    assert.doesNotThrow(() => {
      api.addCustomAttribute('TestName', 'TestValue')
    })
    end()
  })

  await t.test('should properly add custom attributes', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      api.addCustomAttribute('test', 1)
      const attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)

      assert.equal(attributes.test, 1)

      transaction.end()
      end()
    })
  })

  await t.test('should skip if attribute key length limit is exceeded', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      const tooLong = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Cras id lacinia erat. Suspendisse mi nisl, sodales vel est eu,',
        'rhoncus lacinia ante. Nulla tincidunt efficitur diam, eget vulputate',
        'lectus facilisis sit amet. Morbi hendrerit commodo quam, in nullam.'
      ].join(' ')

      api.addCustomAttribute(tooLong, 'will fail')
      const attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)

      const hasTooLong = Object.hasOwnProperty.call(attributes, 'tooLong')
      assert.ok(!hasTooLong)

      transaction.end()
      end()
    })
  })

  await t.test('should properly add multiple custom attributes', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      api.addCustomAttributes({
        one: 1,
        two: 2
      })
      const attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)

      assert.equal(attributes.one, 1)
      assert.equal(attributes.two, 2)

      transaction.end()
      end()
    })
  })

  await t.test('should not add custom attributes when disabled', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      agent.config.api.custom_attributes_enabled = false
      api.addCustomAttribute('test', 1)
      const attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)

      const hasTest = Object.hasOwnProperty.call(attributes, 'test')
      assert.ok(!hasTest)

      agent.config.api.custom_attributes_enabled = true
      transaction.end()
      end()
    })
  })

  await t.test('should not add multiple custom attributes when disabled', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      agent.config.api.custom_attributes_enabled = false
      api.addCustomAttributes({
        one: 1,
        two: 2
      })
      const attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)

      const hasOne = Object.hasOwnProperty.call(attributes, 'one')
      const hasTwo = Object.hasOwnProperty.call(attributes, 'two')
      assert.ok(!hasOne)
      assert.ok(!hasTwo)

      agent.config.api.custom_attributes_enabled = true
      transaction.end()
      end()
    })
  })

  await t.test('should not add custom attributes in high security mode', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      agent.config.high_security = true
      api.addCustomAttribute('test', 1)
      const attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)

      const hasTest = Object.hasOwnProperty.call(attributes, 'test')
      assert.ok(!hasTest)

      agent.config.high_security = false
      transaction.end()
      end()
    })
  })

  await t.test('should not add multiple custom attributes in high security mode', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      agent.config.high_security = true
      api.addCustomAttributes({
        one: 1,
        two: 2
      })
      const attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)

      const hasOne = Object.hasOwnProperty.call(attributes, 'one')
      const hasTwo = Object.hasOwnProperty.call(attributes, 'two')
      assert.ok(!hasOne)
      assert.ok(!hasTwo)

      agent.config.high_security = false
      transaction.end()
      end()
    })
  })

  await t.test('should keep the most-recently seen value', (t, end) => {
    const { agent, api } = t.nr
    agent.on('transactionFinished', function (transaction) {
      const attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(attributes.TestName, 'Third')

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.addCustomAttribute('TestName', 'TestValue')
      api.addCustomAttribute('TestName', 'Second')
      api.addCustomAttribute('TestName', 'Third')

      transaction.end()
    })
  })

  await t.test('should roll with it if custom attributes are gone', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      const trace = transaction.trace
      delete trace.custom

      // should not throw
      api.addCustomAttribute('TestName', 'TestValue')

      end()
    })
  })

  await t.test('should not allow setting of excluded attributes', (t, end) => {
    const { agent, api } = t.nr
    agent.config.attributes.exclude.push('ignore_me')
    agent.config.emit('attributes.exclude')

    agent.on('transactionFinished', function (transaction) {
      const attributes = transaction.trace.custom.get(DESTINATIONS.TRANS_TRACE)

      const hasIgnore = Object.hasOwnProperty.call(attributes, 'ignore_me')
      assert.ok(!hasIgnore)

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.addCustomAttribute('ignore_me', 'set')

      transaction.end()
    })
  })

  await t.test('should properly add custom span attribute', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      transaction.name = 'test'
      api.startSegment('foobar', false, function () {
        api.addCustomSpanAttribute('spannnnnny', 1)
        const segment = api.shim.getSegment()
        const span = SpanEvent.fromSegment(segment, 'parent')
        const attributes = span.customAttributes

        assert.equal(attributes.spannnnnny, 1)
      })

      transaction.end()
      end()
    })
  })

  await t.test('should properly add multiple custom span attributes', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      api.startSegment('foo', false, () => {
        api.addCustomSpanAttributes({
          one: 1,
          two: 2
        })
        const segment = api.shim.getSegment()
        const span = SpanEvent.fromSegment(segment, 'parent')
        const attributes = span.customAttributes

        assert.equal(attributes.one, 1)
        assert.equal(attributes.two, 2)
      })
      api.addCustomAttributes({
        one: 1,
        two: 2
      })

      transaction.end()
      end()
    })
  })
})
