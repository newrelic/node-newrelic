/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../lib/agent_helper')
const NAMES = require('../../../lib/metrics/names.js')
const Exception = require('../../../lib/errors').Exception
const urltils = require('../../../lib/util/urltils')
const errorHelper = require('../../../lib/errors/helper')
const API = require('../../../api')

tap.test('Expected Errors, when expected configuration is present', (t) => {
  t.autoend()
  let agent

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('expected status code should not increment apdex frustrating', (t) => {
    helper.runInTransaction(agent, function (tx) {
      agent.config.error_collector.expected_status_codes = [500]
      tx.statusCode = 500
      const apdexStats = tx.metrics.getOrCreateApdexMetric(NAMES.APDEX)
      tx._setApdex(NAMES.APDEX, 1, 1)
      const json = apdexStats.toJSON()
      tx.end()
      // no errors in the frustrating column
      t.equal(json[2], 0)
      t.end()
    })
  })

  t.test('expected messages', (t) => {
    helper.runInTransaction(agent, function (tx) {
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_messages = { Error: ['expected'] }

      let error = new Error('expected')
      let exception = new Exception({ error })
      tx.addException(exception)

      error = new Error('NOT expected')
      exception = new Exception({ error })
      tx.addException(exception)

      tx.end()

      const errorUnexpected = agent.errors.eventAggregator.getEvents()[0]
      t.equal(
        errorUnexpected[0]['error.message'],
        'NOT expected',
        'should be able to test unexpected errors'
      )
      t.equal(
        errorUnexpected[0]['error.expected'],
        false,
        'unexpected errors should not have error.expected'
      )

      const errorExpected = agent.errors.eventAggregator.getEvents()[1]
      t.equal(
        errorExpected[0]['error.message'],
        'expected',
        'should be able to test expected errors'
      )
      t.equal(
        errorExpected[0]['error.expected'],
        true,
        'expected errors should have error.expected'
      )

      t.end()
    })
  })

  t.test('expected classes', (t) => {
    helper.runInTransaction(agent, function (tx) {
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_classes = ['ReferenceError']

      let error = new ReferenceError('expected')
      let exception = new Exception({ error })
      tx.addException(exception)

      error = new Error('NOT expected')
      exception = new Exception({ error })
      tx.addException(exception)

      tx.end()

      const errorUnexpected = agent.errors.eventAggregator.getEvents()[0]
      t.equal(
        errorUnexpected[0]['error.message'],
        'NOT expected',
        'should be able to test class-unexpected error'
      )
      t.notOk(
        errorUnexpected[2]['error.expected'],
        'class-unexpected error should not have error.expected'
      )

      const errorExpected = agent.errors.eventAggregator.getEvents()[1]
      t.equal(
        errorExpected[0]['error.message'],
        'expected',
        'should be able to test class-expected error'
      )
      t.equal(
        errorExpected[0]['error.expected'],
        true,
        'class-expected error should have error.expected'
      )

      t.end()
    })
  })

  t.test('expected messages by type', (t) => {
    helper.runInTransaction(agent, function (tx) {
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_messages = {
        ReferenceError: ['expected if a ReferenceError']
      }

      let error = new ReferenceError('expected if a ReferenceError')
      let exception = new Exception({ error })
      tx.addException(exception)

      error = new Error('expected if a ReferenceError')
      exception = new Exception({ error })
      tx.addException(exception)

      tx.end()

      const errorUnexpected = agent.errors.eventAggregator.getEvents()[0]
      t.equal(errorUnexpected[0]['error.class'], 'Error')
      t.notOk(
        errorUnexpected[2]['error.expected'],
        'type-unexpected errors should not have error.expected'
      )

      const errorExpected = agent.errors.eventAggregator.getEvents()[1]
      t.equal(errorExpected[0]['error.class'], 'ReferenceError')
      t.equal(
        errorExpected[0]['error.expected'],
        true,
        'type-expected errors should have error.expected'
      )

      t.end()
    })
  })

  t.test('expected errors raised via noticeError should not increment apdex frustrating', (t) => {
    helper.runInTransaction(agent, function (tx) {
      const api = new API(agent)
      api.noticeError(new Error('we expected something to go wrong'), {}, true)
      const apdexStats = tx.metrics.getOrCreateApdexMetric(NAMES.APDEX)
      tx._setApdex(NAMES.APDEX, 1, 1)
      const json = apdexStats.toJSON()
      tx.end()
      // no errors in the frustrating column
      t.equal(json[2], 0)
      t.end()
    })
  })

  t.test('should increment expected error metric call counts', (t) => {
    helper.runInTransaction(agent, function (tx) {
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_classes = ['Error']

      const error1 = new Error('expected')
      const error2 = new ReferenceError('NOT expected')
      const exception1 = new Exception({ error: error1 })
      const exception2 = new Exception({ error: error2 })

      tx.addException(exception1)
      tx.addException(exception2)
      tx.end()

      const transactionErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const expectedErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.EXPECTED)

      t.equal(
        transactionErrorMetric.callCount,
        1,
        'transactionErrorMetric.callCount should equal 1'
      )
      t.equal(expectedErrorMetric.callCount, 1, 'expectedErrorMetric.callCount should equal 1')
      t.end()
    })
  })

  t.test('should not increment error metric call counts, web transaction', (t) => {
    helper.runInTransaction(agent, function (tx) {
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_classes = ['Error']

      const error1 = new Error('expected')
      const error2 = new ReferenceError('NOT expected')
      const exception1 = new Exception({ error: error1 })
      const exception2 = new Exception({ error: error2 })

      tx.addException(exception1)
      tx.addException(exception2)
      tx.end()

      const transactionErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      t.equal(transactionErrorMetric.callCount, 1, '')

      t.equal(allErrorMetric.callCount, 1, 'allErrorMetric.callCount should equal 1')
      t.equal(webErrorMetric.callCount, 1, 'webErrorMetric.callCount should equal 1')
      t.notOk(otherErrorMetric, 'should not create other error metrics')
      t.end()
    })
  })

  t.test('should not generate any error metrics during expected status code', (t) => {
    helper.runInTransaction(agent, function (tx) {
      agent.config.error_collector.expected_status_codes = [500]
      tx.statusCode = 500

      const error1 = new Error('expected')
      const error2 = new ReferenceError('NOT expected')
      const exception1 = new Exception({ error: error1 })
      const exception2 = new Exception({ error: error2 })

      tx.addException(exception1)
      tx.addException(exception2)
      tx.end()

      const transactionErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      t.notOk(transactionErrorMetric, 'should not create transactionErrorMetrics')

      t.notOk(allErrorMetric, 'should not create NAMES.ERRORS.ALL metrics')
      t.notOk(webErrorMetric, 'should not create NAMES.ERRORS.WEB metrics')
      t.notOk(otherErrorMetric, 'should not create NAMES.ERRORS.OTHER metrics')
      t.end()
    })
  })

  t.test('should not increment error metric call counts, bg transaction', (t) => {
    helper.runInTransaction(agent, function (tx) {
      tx.type = 'BACKGROUND'
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_classes = ['Error']

      const error1 = new Error('expected')
      const error2 = new ReferenceError('NOT expected')
      const exception1 = new Exception({ error: error1 })
      const exception2 = new Exception({ error: error2 })

      tx.addException(exception1)
      tx.addException(exception2)
      tx.end()

      const transactionErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      t.equal(
        transactionErrorMetric.callCount,
        1,
        'should increment transactionErrorMetric.callCount'
      )

      t.equal(allErrorMetric.callCount, 1, 'should increment allErrorMetric.callCount')
      t.notOk(webErrorMetric, 'should not increment webErrorMetric')
      t.equal(otherErrorMetric.callCount, 1, 'should increment otherErrorMetric.callCount')
      t.end()
    })
  })

  t.test('should not increment error metric call counts, bg transaction', (t) => {
    helper.runInTransaction(agent, function (tx) {
      agent.config.error_collector.expected_messages = { Error: ['except this error'] }
      const error = new Error('except this error')
      const exception = new Exception({ error })
      const result = errorHelper.isExpectedException(tx, exception, agent.config, urltils)

      t.equal(result, true)
      t.end()
    })
  })

  t.test('status code + "all expected" errors should not affect apdex', (t) => {
    // when we have an error-like status code, and all the collected errors
    // are expected, we can safely assume that the error-like status code
    // came from an expected error
    helper.runInTransaction(agent, function (tx) {
      tx.statusCode = 500
      const apdexStats = tx.metrics.getOrCreateApdexMetric(NAMES.APDEX)
      const errorCollector = agent.config.error_collector
      errorCollector.expected_messages = {
        Error: ['apdex is frustrating']
      }
      errorCollector.ignore_messages = {
        ReferenceError: ['apdex is frustrating']
      }

      let error = new Error('apdex is frustrating')
      let exception = new Exception({ error })
      tx.addException(exception)

      error = new ReferenceError('apdex is frustrating')
      exception = new Exception({ error })
      tx.addException(exception)

      t.equal(tx.hasOnlyExpectedErrors(), true)

      tx._setApdex(NAMES.APDEX, 1, 1)
      const json = apdexStats.toJSON()
      tx.end()
      // no errors in the frustrating column
      t.equal(json[2], 0)
      t.end()
    })
  })

  t.test('status code + no expected errors should frustrate apdex', (t) => {
    helper.runInTransaction(agent, function (tx) {
      tx.statusCode = 500
      const apdexStats = tx.metrics.getOrCreateApdexMetric(NAMES.APDEX)
      t.equal(tx.hasOnlyExpectedErrors(), false)

      tx._setApdex(NAMES.APDEX, 1, 1)
      const json = apdexStats.toJSON()
      tx.end()
      // should put an error in the frustrating column
      t.equal(json[2], 1)
      t.end()
    })
  })

  t.test('status code + "not all expected" errors should frustrate apdex', (t) => {
    // when we have an error-like status code, and some of the collected
    // errors are expected, but others are not, we have no idea which error
    // resulted in the error-like status code.  Therefore we still bump
    // apdex to frustrating.

    helper.runInTransaction(agent, function (tx) {
      tx.statusCode = 500
      const apdexStats = tx.metrics.getOrCreateApdexMetric(NAMES.APDEX)
      agent.config.error_collector.expected_messages = {
        Error: ['apdex is frustrating']
      }

      let error = new Error('apdex is frustrating')
      let exception = new Exception({ error })
      tx.addException(exception)

      error = new ReferenceError('apdex is frustrating')
      exception = new Exception({ error })
      tx.addException(exception)

      tx._setApdex(NAMES.APDEX, 1, 1)
      const json = apdexStats.toJSON()
      tx.end()
      // should have an error in the frustrating column
      t.equal(json[2], 1)
      t.end()
    })
  })
})
