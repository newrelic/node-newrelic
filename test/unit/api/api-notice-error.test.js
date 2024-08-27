/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

test('Agent API - noticeError', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)

    agent.config.attributes.enabled = true
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should add the error even without a transaction', (t, end) => {
    const { agent, api } = t.nr
    assert.equal(agent.errors.traceAggregator.errors.length, 0)
    api.noticeError(new TypeError('this test is bogus, man'))
    assert.equal(agent.errors.traceAggregator.errors.length, 1)

    end()
  })

  await t.test('should still add errors in high security mode', (t, end) => {
    const { agent, api } = t.nr
    agent.config.high_security = true
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'))

    assert.equal(agent.errors.traceAggregator.errors.length, 1)
    agent.config.high_security = false

    end()
  })

  await t.test(
    'should not track custom attributes if custom_attributes_enabled is false',
    (t, end) => {
      const { agent, api } = t.nr
      agent.config.api.custom_attributes_enabled = false
      assert.equal(agent.errors.traceAggregator.errors.length, 0)

      api.noticeError(new TypeError('this test is bogus, man'), { crucial: 'attribute' })

      assert.equal(agent.errors.traceAggregator.errors.length, 1)
      const attributes = agent.errors.traceAggregator.errors[0][4]
      assert.deepEqual(attributes.userAttributes, {})
      agent.config.api.custom_attributes_enabled = true

      end()
    }
  )

  await t.test('should not track custom attributes in high security mode', (t, end) => {
    const { agent, api } = t.nr
    agent.config.high_security = true
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'), { crucial: 'attribute' })

    assert.equal(agent.errors.traceAggregator.errors.length, 1)
    const attributes = agent.errors.traceAggregator.errors[0][4]
    assert.deepEqual(attributes.userAttributes, {})
    agent.config.high_security = false

    end()
  })

  await t.test('should not add errors when noticeErrors is disabled', (t, end) => {
    const { agent, api } = t.nr
    agent.config.api.notice_error_enabled = false
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'))

    assert.equal(agent.errors.traceAggregator.errors.length, 0)
    agent.config.api.notice_error_enabled = true

    end()
  })

  await t.test('should track custom parameters on error without a transaction', (t, end) => {
    const { agent, api } = t.nr
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'), { present: 'yep' })

    assert.equal(agent.errors.traceAggregator.errors.length, 1)

    const params = agent.errors.traceAggregator.errors[0][4]
    assert.equal(params.userAttributes.present, 'yep')

    end()
  })

  await t.test('should omit improper types of attributes', (t, end) => {
    const { agent, api } = t.nr
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'), {
      string: 'yep',
      object: {},
      function: function () {},
      number: 1234,
      symbol: Symbol('test'),
      undef: undefined,
      array: [],
      boolean: true
    })

    assert.equal(agent.errors.traceAggregator.errors.length, 1)

    const params = agent.errors.traceAggregator.errors[0][4]
    assert.equal(params.userAttributes.string, 'yep')
    assert.equal(params.userAttributes.number, 1234)
    assert.equal(params.userAttributes.boolean, true)

    const hasAttribute = Object.hasOwnProperty.bind(params.userAttributes)
    assert.ok(!hasAttribute('object'))
    assert.ok(!hasAttribute('array'))
    assert.ok(!hasAttribute('function'))
    assert.ok(!hasAttribute('undef'))
    assert.ok(!hasAttribute('symbol'))

    end()
  })

  await t.test('should respect attribute filter rules', (t, end) => {
    const { agent, api } = t.nr
    agent.config.attributes.exclude.push('unwanted')
    agent.config.emit('attributes.exclude')
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'), { present: 'yep', unwanted: 'nope' })

    assert.equal(agent.errors.traceAggregator.errors.length, 1)

    const params = agent.errors.traceAggregator.errors[0][4]
    assert.equal(params.userAttributes.present, 'yep')
    assert.ok(!params.userAttributes.unwanted)

    end()
  })

  await t.test('should add the error associated to a transaction', (t, end) => {
    const { agent, api } = t.nr
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      assert.equal(agent.errors.traceAggregator.errors.length, 1)

      const caught = agent.errors.traceAggregator.errors[0]
      const [, transactionName, message, type] = caught
      assert.equal(transactionName, 'Unknown')
      assert.equal(message, 'test error')
      assert.equal(type, 'TypeError')

      assert.equal(transaction.ignore, false)

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError(new TypeError('test error'))
      transaction.end()
    })
  })

  await t.test('should notice custom attributes associated with an error', (t, end) => {
    const { agent, api } = t.nr
    assert.equal(agent.errors.traceAggregator.errors.length, 0)
    const orig = agent.config.attributes.exclude
    agent.config.attributes.exclude = ['ignored']
    agent.config.emit('attributes.exclude')

    agent.on('transactionFinished', function (transaction) {
      assert.equal(agent.errors.traceAggregator.errors.length, 1)
      const caught = agent.errors.traceAggregator.errors[0]

      assert.equal(caught[1], 'Unknown')
      assert.equal(caught[2], 'test error')
      assert.equal(caught[3], 'TypeError')
      assert.equal(caught[4].userAttributes.hi, 'yo')
      assert.equal(caught[4].ignored, undefined)

      assert.equal(transaction.ignore, false)

      agent.config.attributes.exclude = orig
      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError(new TypeError('test error'), { hi: 'yo', ignored: 'yup' })
      transaction.end()
    })
  })

  await t.test('should add an error-alike with a message but no stack', (t, end) => {
    const { agent, api } = t.nr
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      assert.equal(agent.errors.traceAggregator.errors.length, 1)
      const caught = agent.errors.traceAggregator.errors[0]
      assert.equal(caught[1], 'Unknown')
      assert.equal(caught[2], 'not an Error')
      assert.equal(caught[3], 'Object')

      assert.equal(transaction.ignore, false)

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError({ message: 'not an Error' })
      transaction.end()
    })
  })

  await t.test('should add an error-alike with a stack but no message', (t, end) => {
    const { agent, api } = t.nr
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      assert.equal(agent.errors.traceAggregator.errors.length, 1)
      const caught = agent.errors.traceAggregator.errors[0]
      assert.equal(caught[1], 'Unknown')
      assert.equal(caught[2], '')
      assert.equal(caught[3], 'Error')

      assert.equal(transaction.ignore, false)

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError({ stack: new Error().stack })
      transaction.end()
    })
  })

  await t.test("shouldn't throw on (or capture) a useless error object", (t, end) => {
    const { agent, api } = t.nr
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      assert.equal(agent.errors.traceAggregator.errors.length, 0)
      assert.equal(transaction.ignore, false)

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      assert.doesNotThrow(() => api.noticeError({}))
      transaction.end()
    })
  })

  await t.test('should add a string error associated to a transaction', (t, end) => {
    const { agent, api } = t.nr
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      assert.equal(agent.errors.traceAggregator.errors.length, 1)
      const caught = agent.errors.traceAggregator.errors[0]
      assert.equal(caught[1], 'Unknown')
      assert.equal(caught[2], 'busted, bro')
      assert.equal(caught[3], 'Error')

      assert.equal(transaction.ignore, false)

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError('busted, bro')
      transaction.end()
    })
  })

  await t.test('should allow custom parameters to be added to string errors', (t, end) => {
    const { agent, api } = t.nr
    assert.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      assert.equal(agent.errors.traceAggregator.errors.length, 1)
      const caught = agent.errors.traceAggregator.errors[0]
      assert.equal(caught[2], 'busted, bro')
      assert.equal(caught[4].userAttributes.a, 1)
      assert.equal(caught[4].userAttributes.steak, 'sauce')

      assert.equal(transaction.ignore, false)

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError('busted, bro', { a: 1, steak: 'sauce' })
      transaction.end()
    })
  })
})
