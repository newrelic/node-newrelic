/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const { APDEX, ERRORS } = require('../../../lib/metrics/names')
const { Exception } = require('../../../lib/errors')
const urltils = require('../../../lib/util/urltils')
const errorHelper = require('../../../lib/errors/helper')
const API = require('../../../api')

test('Expected Errors, when expected configuration is present', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('expected status code should not increment apdex frustrating', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      agent.config.error_collector.expected_status_codes = [500]
      tx.statusCode = 500

      const apdexStats = tx.metrics.getOrCreateApdexMetric(APDEX)
      tx._setApdex(APDEX, 1, 1)
      const json = apdexStats.toJSON()
      tx.end()
      assert.equal(json[2], 0, 'should be no errors in the frustrating column')
      end()
    })
  })

  await t.test('expected messages', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_messages = { Error: ['expected'] }

      let error = Error('expected')
      let exception = new Exception({ error })
      tx.addException(exception)

      error = Error('NOT expected')
      exception = new Exception({ error })
      tx.addException(exception)

      tx.end()

      const errorUnexpected = agent.errors.eventAggregator.getEvents()[0]
      assert.equal(
        errorUnexpected[0]['error.message'],
        'NOT expected',
        'should be able to test unexpected errors'
      )
      assert.equal(
        errorUnexpected[0]['error.expected'],
        false,
        'unexpected errors should not have error.expected'
      )

      const errorExpected = agent.errors.eventAggregator.getEvents()[1]
      assert.equal(
        errorExpected[0]['error.message'],
        'expected',
        'should be able to test expected errors'
      )
      assert.equal(
        errorExpected[0]['error.expected'],
        true,
        'expected errors should have error.expected'
      )

      end()
    })
  })

  await t.test('expected classes', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_classes = ['ReferenceError']

      let error = new ReferenceError('expected')
      let exception = new Exception({ error })
      tx.addException(exception)

      error = Error('NOT expected')
      exception = new Exception({ error })
      tx.addException(exception)

      tx.end()

      const errorUnexpected = agent.errors.eventAggregator.getEvents()[0]
      assert.equal(
        errorUnexpected[0]['error.message'],
        'NOT expected',
        'should be able to test class-unexpected error'
      )
      assert.equal(
        errorUnexpected[2]['error.expected'],
        undefined,
        'class-unexpected error should not have error.expected'
      )

      const errorExpected = agent.errors.eventAggregator.getEvents()[1]
      assert.equal(
        errorExpected[0]['error.message'],
        'expected',
        'should be able to test class-expected error'
      )
      assert.equal(
        errorExpected[0]['error.expected'],
        true,
        'class-expected error should have error.expected'
      )

      end()
    })
  })

  await t.test('expected messages by type', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_messages = {
        ReferenceError: ['expected if a ReferenceError']
      }

      let error = new ReferenceError('expected if a ReferenceError')
      let exception = new Exception({ error })
      tx.addException(exception)

      error = Error('expected if a ReferenceError')
      exception = new Exception({ error })
      tx.addException(exception)

      tx.end()

      const errorUnexpected = agent.errors.eventAggregator.getEvents()[0]
      assert.equal(errorUnexpected[0]['error.class'], 'Error')
      assert.equal(
        errorUnexpected[2]['error.expected'],
        undefined,
        'type-unexpected errors should not have error.expected'
      )

      const errorExpected = agent.errors.eventAggregator.getEvents()[1]
      assert.equal(errorExpected[0]['error.class'], 'ReferenceError')
      assert.equal(
        errorExpected[0]['error.expected'],
        true,
        'type-expected errors should have error.expected'
      )

      end()
    })
  })

  await t.test(
    'expected errors raised via noticeError should not increment apdex frustrating',
    (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (tx) => {
        const api = new API(agent)
        api.noticeError(new Error('we expected something to go wrong'), {}, true)
        const apdexStats = tx.metrics.getOrCreateApdexMetric(APDEX)
        tx._setApdex(APDEX, 1, 1)
        const json = apdexStats.toJSON()
        tx.end()

        assert.equal(json[2], 0, 'should be no errors in the frustrating column')
        end()
      })
    }
  )

  await t.test('should increment expected error metric call counts', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_classes = ['Error']

      const error1 = Error('expected')
      const error2 = new ReferenceError('NOT expected')
      const exception1 = new Exception({ error: error1 })
      const exception2 = new Exception({ error: error2 })

      tx.addException(exception1)
      tx.addException(exception2)
      tx.end()

      const transactionErrorMetric = agent.metrics.getMetric(ERRORS.PREFIX + tx.getFullName())

      const expectedErrorMetric = agent.metrics.getMetric(ERRORS.EXPECTED)

      assert.equal(
        transactionErrorMetric.callCount,
        1,
        'transactionErrorMetric.callCount should equal 1'
      )
      assert.equal(expectedErrorMetric.callCount, 1, 'expectedErrorMetric.callCount should equal 1')
      end()
    })
  })

  await t.test('should not increment error metric call counts, web transaction', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_classes = ['Error']

      const error1 = Error('expected')
      const error2 = new ReferenceError('NOT expected')
      const exception1 = new Exception({ error: error1 })
      const exception2 = new Exception({ error: error2 })

      tx.addException(exception1)
      tx.addException(exception2)
      tx.end()

      const transactionErrorMetric = agent.metrics.getMetric(ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(ERRORS.OTHER)

      assert.equal(transactionErrorMetric.callCount, 1, '')

      assert.equal(allErrorMetric.callCount, 1, 'allErrorMetric.callCount should equal 1')
      assert.equal(webErrorMetric.callCount, 1, 'webErrorMetric.callCount should equal 1')
      assert.equal(otherErrorMetric, undefined, 'should not create other error metrics')
      end()
    })
  })

  await t.test('should not generate any error metrics during expected status code', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      agent.config.error_collector.expected_status_codes = [500]
      tx.statusCode = 500

      const error1 = Error('expected')
      const error2 = new ReferenceError('NOT expected')
      const exception1 = new Exception({ error: error1 })
      const exception2 = new Exception({ error: error2 })

      tx.addException(exception1)
      tx.addException(exception2)
      tx.end()

      const transactionErrorMetric = agent.metrics.getMetric(ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(ERRORS.OTHER)

      assert.equal(transactionErrorMetric, undefined, 'should not create transactionErrorMetrics')

      assert.equal(allErrorMetric, undefined, 'should not create ERRORS.ALL metrics')
      assert.equal(webErrorMetric, undefined, 'should not create ERRORS.WEB metrics')
      assert.equal(otherErrorMetric, undefined, 'should not create ERRORS.OTHER metrics')
      end()
    })
  })

  await t.test('should not increment error metric call counts, bg transaction', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function (tx) {
      tx.type = 'BACKGROUND'
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.expected_classes = ['Error']

      const error1 = Error('expected')
      const error2 = new ReferenceError('NOT expected')
      const exception1 = new Exception({ error: error1 })
      const exception2 = new Exception({ error: error2 })

      tx.addException(exception1)
      tx.addException(exception2)
      tx.end()

      const transactionErrorMetric = agent.metrics.getMetric(ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(ERRORS.OTHER)

      assert.equal(
        transactionErrorMetric.callCount,
        1,
        'should increment transactionErrorMetric.callCount'
      )

      assert.equal(allErrorMetric.callCount, 1, 'should increment allErrorMetric.callCount')
      assert.equal(webErrorMetric, undefined, 'should not increment webErrorMetric')
      assert.equal(otherErrorMetric.callCount, 1, 'should increment otherErrorMetric.callCount')
      end()
    })
  })

  await t.test('should not increment error metric call counts, bg transaction', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      agent.config.error_collector.expected_messages = { Error: ['except this error'] }
      const error = new Error('except this error')
      const exception = new Exception({ error })
      const result = errorHelper.isExpectedException(tx, exception, agent.config, urltils)

      assert.equal(result, true)
      end()
    })
  })

  await t.test('status code + "all expected" errors should not affect apdex', (t, end) => {
    const { agent } = t.nr
    // when we have an error-like status code, and all the collected errors
    // are expected, we can safely assume that the error-like status code
    // came from an expected error
    helper.runInTransaction(agent, (tx) => {
      tx.statusCode = 500
      const apdexStats = tx.metrics.getOrCreateApdexMetric(APDEX)
      const errorCollector = agent.config.error_collector
      errorCollector.expected_messages = {
        Error: ['apdex is frustrating']
      }
      errorCollector.ignore_messages = {
        ReferenceError: ['apdex is frustrating']
      }

      let error = Error('apdex is frustrating')
      let exception = new Exception({ error })
      tx.addException(exception)

      error = new ReferenceError('apdex is frustrating')
      exception = new Exception({ error })
      tx.addException(exception)

      assert.equal(tx.hasOnlyExpectedErrors(), true)

      tx._setApdex(APDEX, 1, 1)
      const json = apdexStats.toJSON()
      tx.end()
      // no errors in the frustrating column
      assert.equal(json[2], 0)
      end()
    })
  })

  await t.test('status code + no expected errors should frustrate apdex', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      tx.statusCode = 500
      const apdexStats = tx.metrics.getOrCreateApdexMetric(APDEX)
      assert.equal(tx.hasOnlyExpectedErrors(), false)

      tx._setApdex(APDEX, 1, 1)
      const json = apdexStats.toJSON()
      tx.end()

      assert.equal(json[2], 1, 'should put an error in the frustrating column')
      end()
    })
  })

  await t.test('status code + "not all expected" errors should frustrate apdex', (t, end) => {
    const { agent } = t.nr
    // when we have an error-like status code, and some of the collected
    // errors are expected, but others are not, we have no idea which error
    // resulted in the error-like status code. Therefore, we still bump
    // apdex to frustrating.

    helper.runInTransaction(agent, (tx) => {
      tx.statusCode = 500
      const apdexStats = tx.metrics.getOrCreateApdexMetric(APDEX)
      agent.config.error_collector.expected_messages = {
        Error: ['apdex is frustrating']
      }

      let error = Error('apdex is frustrating')
      let exception = new Exception({ error })
      tx.addException(exception)

      error = new ReferenceError('apdex is frustrating')
      exception = new Exception({ error })
      tx.addException(exception)

      tx._setApdex(APDEX, 1, 1)
      const json = apdexStats.toJSON()
      tx.end()

      assert.equal(json[2], 1, 'should have an error in the frustrating column')
      end()
    })
  })
})
