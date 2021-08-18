/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - noticeError', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    agent.config.attributes.enabled = true
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('should add the error even without a transaction', (t) => {
    t.equal(agent.errors.traceAggregator.errors.length, 0)
    api.noticeError(new TypeError('this test is bogus, man'))
    t.equal(agent.errors.traceAggregator.errors.length, 1)

    t.end()
  })

  t.test('should still add errors in high security mode', (t) => {
    agent.config.high_security = true
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'))

    t.equal(agent.errors.traceAggregator.errors.length, 1)
    agent.config.high_security = false

    t.end()
  })

  t.test('should not track custom attributes if custom_attributes_enabled is false', (t) => {
    agent.config.api.custom_attributes_enabled = false
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'), { crucial: 'attribute' })

    t.equal(agent.errors.traceAggregator.errors.length, 1)
    const attributes = agent.errors.traceAggregator.errors[0][4]
    t.same(attributes.userAttributes, {})
    agent.config.api.custom_attributes_enabled = true

    t.end()
  })

  t.test('should not track custom attributes in high security mode', (t) => {
    agent.config.high_security = true
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'), { crucial: 'attribute' })

    t.equal(agent.errors.traceAggregator.errors.length, 1)
    const attributes = agent.errors.traceAggregator.errors[0][4]
    t.same(attributes.userAttributes, {})
    agent.config.high_security = false

    t.end()
  })

  t.test('should not add errors when noticeErrors is disabled', (t) => {
    agent.config.api.notice_error_enabled = false
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'))

    t.equal(agent.errors.traceAggregator.errors.length, 0)
    agent.config.api.notice_error_enabled = true

    t.end()
  })

  t.test('should track custom parameters on error without a transaction', (t) => {
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'), { present: 'yep' })

    t.equal(agent.errors.traceAggregator.errors.length, 1)

    const params = agent.errors.traceAggregator.errors[0][4]
    t.equal(params.userAttributes.present, 'yep')

    t.end()
  })

  t.test('should omit improper types of attributes', (t) => {
    t.equal(agent.errors.traceAggregator.errors.length, 0)

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

    t.equal(agent.errors.traceAggregator.errors.length, 1)

    const params = agent.errors.traceAggregator.errors[0][4]
    t.equal(params.userAttributes.string, 'yep')
    t.equal(params.userAttributes.number, 1234)
    t.equal(params.userAttributes.boolean, true)

    const hasAttribute = Object.hasOwnProperty.bind(params.userAttributes)
    t.notOk(hasAttribute('object'))
    t.notOk(hasAttribute('array'))
    t.notOk(hasAttribute('function'))
    t.notOk(hasAttribute('undef'))
    t.notOk(hasAttribute('symbol'))

    t.end()
  })

  t.test('should respect attribute filter rules', (t) => {
    agent.config.attributes.exclude.push('unwanted')
    agent.config.emit('attributes.exclude')
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    api.noticeError(new TypeError('this test is bogus, man'), { present: 'yep', unwanted: 'nope' })

    t.equal(agent.errors.traceAggregator.errors.length, 1)

    const params = agent.errors.traceAggregator.errors[0][4]
    t.equal(params.userAttributes.present, 'yep')
    t.notOk(params.userAttributes.unwanted)

    t.end()
  })

  t.test('should add the error associated to a transaction', (t) => {
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      t.equal(agent.errors.traceAggregator.errors.length, 1)

      const caught = agent.errors.traceAggregator.errors[0]
      const [, transactionName, message, type] = caught
      t.equal(transactionName, 'Unknown')
      t.equal(message, 'test error')
      t.equal(type, 'TypeError')

      t.equal(transaction.ignore, false)

      t.end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError(new TypeError('test error'))
      transaction.end()
    })
  })

  t.test('should notice custom attributes associated with an error', (t) => {
    t.equal(agent.errors.traceAggregator.errors.length, 0)
    const orig = agent.config.attributes.exclude
    agent.config.attributes.exclude = ['ignored']
    agent.config.emit('attributes.exclude')

    agent.on('transactionFinished', function (transaction) {
      t.equal(agent.errors.traceAggregator.errors.length, 1)
      const caught = agent.errors.traceAggregator.errors[0]

      t.equal(caught[1], 'Unknown')
      t.equal(caught[2], 'test error')
      t.equal(caught[3], 'TypeError')
      t.equal(caught[4].userAttributes.hi, 'yo')
      t.equal(caught[4].ignored, undefined)

      t.equal(transaction.ignore, false)

      agent.config.attributes.exclude = orig
      t.end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError(new TypeError('test error'), { hi: 'yo', ignored: 'yup' })
      transaction.end()
    })
  })

  t.test('should add an error-alike with a message but no stack', (t) => {
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      t.equal(agent.errors.traceAggregator.errors.length, 1)
      const caught = agent.errors.traceAggregator.errors[0]
      t.equal(caught[1], 'Unknown')
      t.equal(caught[2], 'not an Error')
      t.equal(caught[3], 'Object')

      t.equal(transaction.ignore, false)

      t.end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError({ message: 'not an Error' })
      transaction.end()
    })
  })

  t.test('should add an error-alike with a stack but no message', (t) => {
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      t.equal(agent.errors.traceAggregator.errors.length, 1)
      const caught = agent.errors.traceAggregator.errors[0]
      t.equal(caught[1], 'Unknown')
      t.equal(caught[2], '')
      t.equal(caught[3], 'Error')

      t.equal(transaction.ignore, false)

      t.end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError({ stack: new Error().stack })
      transaction.end()
    })
  })

  t.test("shouldn't throw on (or capture) a useless error object", (t) => {
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      t.equal(agent.errors.traceAggregator.errors.length, 0)
      t.equal(transaction.ignore, false)

      t.end()
    })

    helper.runInTransaction(agent, function (transaction) {
      t.doesNotThrow(() => api.noticeError({}))
      transaction.end()
    })
  })

  t.test('should add a string error associated to a transaction', (t) => {
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      t.equal(agent.errors.traceAggregator.errors.length, 1)
      const caught = agent.errors.traceAggregator.errors[0]
      t.equal(caught[1], 'Unknown')
      t.equal(caught[2], 'busted, bro')
      t.equal(caught[3], 'Error')

      t.equal(transaction.ignore, false)

      t.end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError('busted, bro')
      transaction.end()
    })
  })

  t.test('should allow custom parameters to be added to string errors', (t) => {
    t.equal(agent.errors.traceAggregator.errors.length, 0)

    agent.on('transactionFinished', function (transaction) {
      t.equal(agent.errors.traceAggregator.errors.length, 1)
      const caught = agent.errors.traceAggregator.errors[0]
      t.equal(caught[2], 'busted, bro')
      t.equal(caught[4].userAttributes.a, 1)
      t.equal(caught[4].userAttributes.steak, 'sauce')

      t.equal(transaction.ignore, false)

      t.end()
    })

    helper.runInTransaction(agent, function (transaction) {
      api.noticeError('busted, bro', { a: 1, steak: 'sauce' })
      transaction.end()
    })
  })
})
