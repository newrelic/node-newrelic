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

        expect(errorAggr.traceAggregator.errors.length).equals(1)

        const transactionErrorMetric
          = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

        const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
        const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
        const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

        expect(transactionErrorMetric.callCount).equals(1)

        expect(allErrorMetric.callCount).equals(1)
        expect(webErrorMetric.callCount).equals(1)
        expect(otherErrorMetric).to.not.exist
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

        expect(errorAggr.traceAggregator.errors.length).equals(1)

        const transactionErrorMetric
          = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

        const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
        const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
        const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

        expect(transactionErrorMetric.callCount).equals(1)

        expect(allErrorMetric.callCount).equals(1)
        expect(webErrorMetric.callCount).equals(1)
        expect(otherErrorMetric).to.not.exist
      })
    })

    it('Ignore messages should result in no error reported', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.ignore_messages = {"Error":['ignored']}

        const error1 = new Error('ignored')
        const error2 = new Error('not ignored')
        const error3 = new ReferenceError('not ignored')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.addException(error3, {}, 0)

        tx.end()

        expect(errorAggr.traceAggregator.errors.length).equals(2)

        const transactionErrorMetric
          = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

        const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
        const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
        const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

        expect(transactionErrorMetric.callCount).equals(2)

        expect(allErrorMetric.callCount).equals(2)
        expect(webErrorMetric.callCount).equals(2)
        expect(otherErrorMetric).to.not.exist
      })
    })

    it('Ignore messages should trump expected_messages', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.ignore_messages = {"Error":['ignore']}
        agent.config.error_collector.expected_messages = {"Error":['ignore']}

        const error1 = new Error('ignore')
        const error2 = new Error('not ignore')
        const error3 = new ReferenceError('not ignore')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.addException(error3, {}, 0)

        tx.end()

        expect(errorAggr.traceAggregator.errors.length).equals(2)

        const transactionErrorMetric
          = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

        const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
        const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
        const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

        expect(transactionErrorMetric.callCount).equals(2)

        expect(allErrorMetric.callCount).equals(2)
        expect(webErrorMetric.callCount).equals(2)
        expect(otherErrorMetric).to.not.exist
      })
    })

    it('Ignore status code should result in 0 errors reported', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.ignore_status_codes = [500]
        tx.statusCode = 500

        const error1 = new Error('ignore')
        const error2 = new Error('ignore me too')
        const error3 = new ReferenceError('i will also be ignored')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.addException(error3, {}, 0)

        tx.end()

        expect(errorAggr.traceAggregator.errors.length).equals(0)

        const transactionErrorMetric
          = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

        const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
        const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
        const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

        expect(transactionErrorMetric).to.not.exist

        expect(allErrorMetric).to.not.exist
        expect(webErrorMetric).to.not.exist
        expect(otherErrorMetric).to.not.exist
      })
    })

    it('Ignore status code should trump expected status code', function() {
      helper.runInTransaction(agent, function(tx) {
        const errorAggr = agent.errors
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.ignore_status_codes = [500]
        agent.config.error_collector.expected_status_codes = [500]
        tx.statusCode = 500

        const error1 = new Error('ignore')
        const error2 = new Error('also ignore')
        const error3 = new ReferenceError('i will also be ignored')

        tx.addException(error1, {}, 0)
        tx.addException(error2, {}, 0)
        tx.addException(error3, {}, 0)

        tx.end()

        expect(errorAggr.traceAggregator.errors.length).equals(0)

        const transactionErrorMetric
          = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

        const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
        const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
        const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

        expect(transactionErrorMetric).to.not.exist

        expect(allErrorMetric).to.not.exist
        expect(webErrorMetric).to.not.exist
        expect(otherErrorMetric).to.not.exist
      })
    })
  })
})
