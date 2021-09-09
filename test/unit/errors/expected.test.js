/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const helper = require('../../lib/agent_helper')
const NAMES = require('../../../lib/metrics/names.js')
const Exception = require('../../../lib/errors').Exception
const chai = require('chai')
const should = require('chai').should()
const urltils = require('../../../lib/util/urltils')
const errorHelper = require('../../../lib/errors/helper')

const expect = chai.expect

describe('Expected Errors', function () {
  describe('when expeced configuration is present', function () {
    let agent

    beforeEach(function () {
      agent = helper.loadMockedAgent()
    })

    afterEach(function () {
      helper.unloadAgent(agent)
      agent = null
    })

    it('expected status code should not increment apdex frustrating', function () {
      helper.runInTransaction(agent, function (tx) {
        agent.config.error_collector.expected_status_codes = [500]
        tx.statusCode = 500
        const apdexStats = tx.metrics.getOrCreateApdexMetric(NAMES.APDEX)
        tx._setApdex(NAMES.APDEX, 1, 1)
        const json = apdexStats.toJSON()
        tx.end()
        // no errors in the frustrating column
        expect(json[2]).equals(0)
      })
    })

    it('expected messages', function (done) {
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
        expect(errorUnexpected[0]['error.message']).equals('NOT expected')
        expect(errorUnexpected[0]['error.expected']).equals(false)

        const errorExpected = agent.errors.eventAggregator.getEvents()[1]
        expect(errorExpected[0]['error.message']).equals('expected')
        expect(errorExpected[0]['error.expected']).equals(true)

        done()
      })
    })

    it('expected classes', function (done) {
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
        expect(errorUnexpected[0]['error.message']).equals('NOT expected')
        should.not.exist(errorUnexpected[2]['error.expected'])

        const errorExpected = agent.errors.eventAggregator.getEvents()[1]
        expect(errorExpected[0]['error.message']).equals('expected')
        expect(errorExpected[0]['error.expected']).equals(true)

        done()
      })
    })

    it('expected messages by type', function (done) {
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
        expect(errorUnexpected[0]['error.class']).equals('Error')
        should.not.exist(errorUnexpected[2]['error.expected'])

        const errorExpected = agent.errors.eventAggregator.getEvents()[1]
        expect(errorExpected[0]['error.class']).equals('ReferenceError')
        expect(errorExpected[0]['error.expected']).equals(true)

        done()
      })
    })

    it('should increment expected error metric call counts', function () {
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

        const transactionErrorMetric = agent.metrics.getMetric(
          NAMES.ERRORS.PREFIX + tx.getFullName()
        )

        const expectedErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.EXPECTED)

        expect(transactionErrorMetric.callCount).equals(1)
        expect(expectedErrorMetric.callCount).equals(1)
      })
    })

    it('should not increment error metric call counts, web transaction', function () {
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

        const transactionErrorMetric = agent.metrics.getMetric(
          NAMES.ERRORS.PREFIX + tx.getFullName()
        )

        const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
        const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
        const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

        expect(transactionErrorMetric.callCount).equals(1)

        expect(allErrorMetric.callCount).equals(1)
        expect(webErrorMetric.callCount).equals(1)
        expect(otherErrorMetric).to.not.exist
      })
    })

    it('should not generate any error metrics during expected status code', function () {
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

        const transactionErrorMetric = agent.metrics.getMetric(
          NAMES.ERRORS.PREFIX + tx.getFullName()
        )

        const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
        const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
        const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

        expect(transactionErrorMetric).to.not.exist

        expect(allErrorMetric).to.not.exist
        expect(webErrorMetric).to.not.exist
        expect(otherErrorMetric).to.not.exist
      })
    })

    it('should not increment error metric call counts, bg transaction', function () {
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

        const transactionErrorMetric = agent.metrics.getMetric(
          NAMES.ERRORS.PREFIX + tx.getFullName()
        )

        const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
        const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
        const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

        expect(transactionErrorMetric.callCount).equals(1)

        expect(allErrorMetric.callCount).equals(1)
        expect(webErrorMetric).to.not.exist
        expect(otherErrorMetric.callCount).to.equal(1)
      })
    })

    it('should not increment error metric call counts, bg transaction', function () {
      helper.runInTransaction(agent, function (tx) {
        agent.config.error_collector.expected_messages = { Error: ['except this error'] }
        const exception = new Error('except this error')
        const result = errorHelper.isExpectedException(tx, exception, agent.config, urltils)

        expect(result).equals(true)
      })
    })

    it('status code + "all expected" errors should not affect apdex', function () {
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

        expect(tx.hasOnlyExpectedErrors()).equals(true)

        tx._setApdex(NAMES.APDEX, 1, 1)
        const json = apdexStats.toJSON()
        tx.end()
        // no errors in the frustrating column
        expect(json[2]).equals(0)
      })
    })

    it('status code + no errors should frustrate apdex', function () {
      helper.runInTransaction(agent, function (tx) {
        tx.statusCode = 500
        const apdexStats = tx.metrics.getOrCreateApdexMetric(NAMES.APDEX)
        expect(tx.hasOnlyExpectedErrors()).equals(false)

        tx._setApdex(NAMES.APDEX, 1, 1)
        const json = apdexStats.toJSON()
        tx.end()
        // no errors in the frustrating column
        expect(json[2]).equals(1)
      })
    })

    it('status code + "not all expected" errors should frustrate apdex', function () {
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
        // no errors in the frustrating column
        expect(json[2]).equals(1)
      })
    })
  })
})
