'use strict'

const helper = require('../../lib/agent_helper')
const NAMES = require('../../../lib/metrics/names.js')
const chai = require('chai')

const expect  = chai.expect

describe('Ignored Errors', function() {
  describe('when expected configuration is present', function() {
    var agent

    beforeEach(function() {
      agent = helper.loadMockedAgent()
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })
    it('Ignore Classes should result in no error reported', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.ignore_classes = ["Error"]

        const error1 = new Error('ignored')
        const error2 = new ReferenceError('NOT ignored')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.end()

        expect(errorAggr.getErrors().length).equals(1)

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

    it('Ignore Classes should trump expected classes', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.ignore_classes = ["Error"]
        agent.config.error_collector.expected_classes = ["Error"]

        const error1 = new Error('ignored')
        const error2 = new ReferenceError('NOT ignored')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.end()

        // console.log(errorAggr.getErrors().length)
        expect(errorAggr.getErrors().length).equals(1)

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

    it('Ignore messages should result in no error reported', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.ignore_messages = {"Error":['alpha']}

        const error1 = new Error('alpha')           // will ignore
        const error2 = new Error('omega')           // will not ignore
        const error3 = new ReferenceError('alpha')  // will ignore

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.addException(error3, {}, 0)

        tx.end()

        expect(errorAggr.getErrors().length).equals(2)

        expect(
          agent.metrics.getOrCreateMetric(
            NAMES.ERRORS.PREFIX + tx.getFullName()
          ).callCount
        ).equals(2)

        // NAMES.ERRORS.ALL, NAMES.ERRORS.WEB, and NAMES.ERRORS.OTHER
        // are generated during the harvest.  We can't check the metric
        // before the harvest since its not there, but after the harvest
        // the metric will have been sent and zeroed out.  So we'll check
        // the actual methods called during the harvest instead
        expect(errorAggr.getTotalUnexpectedErrorCount()).equals(2)
        expect(errorAggr.getUnexpectedWebTransactionsErrorCount()).equals(2)
        expect(errorAggr.getUnexpectedOtherTransactionsErrorCount()).equals(0)
      })
    })

    it('Ignore messages should trump expected_messages', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.ignore_messages = {"Error":['alpha']}
        agent.config.error_collector.expected_messages = {"Error":['alpha']}

        const error1 = new Error('alpha')           // will ignore
        const error2 = new Error('omega')           // will not ignore
        const error3 = new ReferenceError('alpha')  // will ignore

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.addException(error3, {}, 0)

        tx.end()

        expect(errorAggr.getErrors().length).equals(2)

        expect(
          agent.metrics.getOrCreateMetric(
            NAMES.ERRORS.PREFIX + tx.getFullName()
          ).callCount
        ).equals(2)

        // NAMES.ERRORS.ALL, NAMES.ERRORS.WEB, and NAMES.ERRORS.OTHER
        // are generated during the harvest.  We can't check the metric
        // before the harvest since its not there, but after the harvest
        // the metric will have been sent and zeroed out.  So we'll check
        // the actual methods called during the harvest instead
        expect(errorAggr.getTotalUnexpectedErrorCount()).equals(2)
        expect(errorAggr.getUnexpectedWebTransactionsErrorCount()).equals(2)
        expect(errorAggr.getUnexpectedOtherTransactionsErrorCount()).equals(0)
      })
    })

    it('Ignore status code should result in 0 errors reported', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.ignore_status_codes = [500]
        tx.statusCode = 500

        const error1 = new Error('alpha')
        const error2 = new Error('omega')
        const error3 = new ReferenceError('alpha')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.addException(error3, {}, 0)

        tx.end()

        expect(errorAggr.getErrors().length).equals(0)

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

    it('Ignore status code should trump expected status code', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.ignore_status_codes = [500]
        agent.config.error_collector.expected_status_codes = [500]
        tx.statusCode = 500

        const error1 = new Error('alpha')
        const error2 = new Error('omega')
        const error3 = new ReferenceError('alpha')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.addException(error3, {}, 0)

        tx.end()

        expect(errorAggr.getErrors().length).equals(0)

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
  })
})
