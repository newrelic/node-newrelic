'use strict'

const helper = require('../../lib/agent_helper')
const NAMES = require('../../../lib/metrics/names.js')
const chai = require('chai')
const should = require('chai').should()
const urltils = require('../../../lib/util/urltils')
const errorHelper = require('../../../lib/errors/helper')

const expect  = chai.expect

describe('Expected Errors', function() {
  describe('when expeced configuration is present', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })
    it('expected status code should not increment apdex frustrating', function() {
      helper.runInTransaction(agent, function(tx) {
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

    it('expected messages', function(done) {
      helper.runInTransaction(agent, function(tx) {
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.expected_messages = {"Error":["expected"]}

        var error = new Error('expected')
        tx.addException(error, {}, 0)

        error = new Error('NOT expected')
        tx.addException(error, {}, 0)

        tx.end()

        const errorUnexpected = agent.errors.getEvents()[0]
        expect(errorUnexpected[0]['error.message']).equals('NOT expected')
        expect(errorUnexpected[0]['error.expected']).equals(false)

        const errorExpected = agent.errors.getEvents()[1]
        expect(errorExpected[0]['error.message']).equals('expected')
        expect(errorExpected[0]['error.expected']).equals(true)

        done()
      })
    })

    it('expected classes', function(done) {
      helper.runInTransaction(agent, function(tx) {
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.expected_classes = ["ReferenceError"]

        var error = new ReferenceError('expected')
        tx.addException(error, {}, 0)

        error = new Error('NOT expected')
        tx.addException(error, {}, 0)

        tx.end()

        const errorUnexpected = agent.errors.getEvents()[0]
        expect(errorUnexpected[0]['error.message']).equals('NOT expected')
        should.not.exist(errorUnexpected[2]['error.expected'])

        const errorExpected = agent.errors.getEvents()[1]
        expect(errorExpected[0]['error.message']).equals('expected')
        expect(errorExpected[0]['error.expected']).equals(true)

        done()
      })
    })

    it('expected messages by type', function(done) {
      helper.runInTransaction(agent, function(tx) {
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.expected_messages = {
          "ReferenceError":["expected if a ReferenceError"]
        }

        var error = new ReferenceError('expected if a ReferenceError')
        tx.addException(error, {}, 0)

        error = new Error('expected if a ReferenceError')
        tx.addException(error, {}, 0)

        tx.end()

        const errorUnexpected = agent.errors.getEvents()[0]
        expect(errorUnexpected[0]['error.class']).equals('Error')
        should.not.exist(errorUnexpected[2]['error.expected'])

        const errorExpected = agent.errors.getEvents()[1]
        expect(errorExpected[0]['error.class']).equals('ReferenceError')
        expect(errorExpected[0]['error.expected']).equals(true)

        done()
      })
    })

    it('should increment expected error metric call counts', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors

        agent.config.error_collector.capture_events = true
        agent.config.error_collector.expected_classes = ["Error"]

        const error1 = new Error('expected')
        const error2 = new ReferenceError('NOT expected')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.end()

        expect(
          agent.metrics.getOrCreateMetric(
            NAMES.ERRORS.PREFIX + tx.getFullName()
          ).callCount
        ).equals(1)

        expect(errorAggr.getTotalExpectedErrorCount()).equals(1)
      })
    })

    it('should not increment error metric call counts, web transaction', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors

        agent.config.error_collector.capture_events = true
        agent.config.error_collector.expected_classes = ["Error"]

        const error1 = new Error('expected')
        const error2 = new ReferenceError('NOT expected')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.end()

        expect(
          agent.metrics.getOrCreateMetric(
            NAMES.ERRORS.PREFIX + tx.getFullName()
          ).callCount
        ).equals(1)

        // NAMES.ERRORS.ALL, NAMES.ERRORS.WEB, and NAMES.ERRORS.OTHER
        // are generated during the harvest.  We can't check the metric
        // before the harvest since its not there, but after the harvest
        // the metric will have been sent and zeroed out.  So we'll check
        // the actual methods called during the harvest instead
        expect(errorAggr.getTotalUnexpectedErrorCount()).equals(1)
        expect(errorAggr.getUnexpectedWebTransactionsErrorCount()).equals(1)
        expect(errorAggr.getUnexpectedOtherTransactionsErrorCount()).equals(0)
      })
    })

    it('should not generate any error metrics during expected status code', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        agent.config.error_collector.expected_status_codes = [500]
        tx.statusCode = 500
        const error1 = new Error('expected')
        const error2 = new ReferenceError('NOT expected')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.end()

        expect(
          agent.metrics.getOrCreateMetric(
            NAMES.ERRORS.PREFIX + tx.getFullName()
          ).callCount
        ).equals(0)

        // NAMES.ERRORS.ALL, NAMES.ERRORS.WEB, and NAMES.ERRORS.OTHER
        // are generated during the harvest.  We can't check the metric
        // before the harvest since its not there, but after the harvest
        // the metric will have been sent and zeroed out.  So we'll check
        // the actual methods called during the harvest instead
        expect(errorAggr.getTotalUnexpectedErrorCount()).equals(0)
        expect(errorAggr.getUnexpectedWebTransactionsErrorCount()).equals(0)
        expect(errorAggr.getUnexpectedOtherTransactionsErrorCount()).equals(0)
      })
    })

    it('should not increment error metric call counts, bg transaction', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        tx.type = "BACKGROUND"
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.expected_classes = ["Error"]

        const error1 = new Error('expected')
        const error2 = new ReferenceError('NOT expected')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.end()

        expect(
          agent.metrics.getOrCreateMetric(
            NAMES.ERRORS.PREFIX + tx.getFullName()
          ).callCount
        ).equals(1)

        // NAMES.ERRORS.ALL, NAMES.ERRORS.WEB, and NAMES.ERRORS.OTHER
        // are generated during the harvest.  We can't check the metric
        // before the harvest since its not there, but after the harvest
        // the metric will have been sent and zeroed out.  So we'll check
        // the actual methods called during the harvest instead
        expect(errorAggr.getTotalUnexpectedErrorCount()).equals(1)
        expect(errorAggr.getUnexpectedWebTransactionsErrorCount()).equals(0)
        expect(errorAggr.getUnexpectedOtherTransactionsErrorCount()).equals(1)
      })
    })

    it('should not increment error metric call counts, bg transaction', function() {
      helper.runInTransaction(agent, function(tx) {
        agent.config.error_collector.expected_messages = {"Error":["except this error"]}
        let exception = new Error("except this error")
        let result = errorHelper.isExpectedException(
          tx,
          exception,
          agent.config,
          urltils
        )

        expect(result).equals(true)
      })
    })

    it('status code + "all expected" errors should not affect apdex', function() {
      // when we have an error-like status code, and all the collected errors
      // are expected, we can safely assume that the error-like status code
      // came from an expected error
      helper.runInTransaction(agent, function(tx) {
        tx.statusCode = 500
        const apdexStats = tx.metrics.getOrCreateApdexMetric(NAMES.APDEX)
        agent.config.error_collector.expected_messages = {
          "Error":["apdex is frustrating"],
          "ReferenceError":["apdex is frustrating"]
        }

        tx.addException(new Error('apdex is frustrating'))
        tx.addException(new ReferenceError('apdex is frustrating'))
        expect(tx.hasOnlyExpectedErrors()).equals(true)

        tx._setApdex(NAMES.APDEX, 1, 1)
        const json = apdexStats.toJSON()
        tx.end()
        // no errors in the frustrating column
        expect(json[2]).equals(0)
      })
    })

    it('status code + "not all expected" errors should frustrate apdex', function() {
      // when we have an error-like status code, and some of the collected
      // errors are expected, but others are not, we have no idea which error
      // resulted in the error-like status code.  Therefore we still bump
      // apdex to frustrating.

      helper.runInTransaction(agent, function(tx) {
        tx.statusCode = 500
        const apdexStats = tx.metrics.getOrCreateApdexMetric(NAMES.APDEX)
        agent.config.error_collector.expected_messages = {
          "Error":["apdex is frustrating"]
        }

        tx.addException(new Error('apdex is frustrating'))
        tx.addException(new ReferenceError('apdex is frustrating'))

        tx._setApdex(NAMES.APDEX, 1, 1)
        const json = apdexStats.toJSON()
        tx.end()
        // no errors in the frustrating column
        expect(json[2]).equals(1)
      })
    })
  })
})
