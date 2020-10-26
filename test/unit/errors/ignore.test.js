/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../lib/agent_helper')
const NAMES = require('../../../lib/metrics/names.js')

tap.test('Ignored Errors', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent()
    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    done()
  })

  t.test('Ignore Classes should result in no error reported', (t) => {
    helper.runInTransaction(agent, function(tx) {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_classes = ["Error"]

      const error1 = new Error('ignored')
      const error2 = new ReferenceError('NOT ignored')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      tx.end()

      t.equal(errorAggr.traceAggregator.errors.length, 1)

      const transactionErrorMetric
        = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      t.equal(transactionErrorMetric.callCount, 1)

      t.equal(allErrorMetric.callCount, 1)
      t.equal(webErrorMetric.callCount, 1)

      t.notOk(otherErrorMetric)

      t.end()
    })
  })

  t.test('Ignore Classes should trump expected classes', (t) => {
    helper.runInTransaction(agent, function(tx) {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_classes = ["Error"]
      agent.config.error_collector.expected_classes = ["Error"]

      const error1 = new Error('ignored')
      const error2 = new ReferenceError('NOT ignored')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      tx.end()

      t.equal(errorAggr.traceAggregator.errors.length, 1)

      const transactionErrorMetric
        = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      t.equal(transactionErrorMetric.callCount, 1)

      t.equal(allErrorMetric.callCount, 1)
      t.equal(webErrorMetric.callCount, 1)
      t.notOk(otherErrorMetric)

      t.end()
    })
  })

  t.test('Ignore messages should result in no error reported', (t) => {
    helper.runInTransaction(agent, function(tx) {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_messages = {"Error":['ignored']}

      const error1 = new Error('ignored')
      const error2 = new Error('not ignored')
      const error3 = new ReferenceError('not ignored')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      errorAggr.add(tx, error3)

      tx.end()

      t.equal(errorAggr.traceAggregator.errors.length, 2)

      const transactionErrorMetric
        = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      t.equal(transactionErrorMetric.callCount, 2)

      t.equal(allErrorMetric.callCount, 2)
      t.equal(webErrorMetric.callCount, 2)
      t.notOk(otherErrorMetric)

      t.end()
    })
  })

  t.test('Ignore messages should trump expected_messages', (t) => {
    helper.runInTransaction(agent, function(tx) {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_messages = {"Error":['ignore']}
      agent.config.error_collector.expected_messages = {"Error":['ignore']}

      const error1 = new Error('ignore')
      const error2 = new Error('not ignore')
      const error3 = new ReferenceError('not ignore')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      errorAggr.add(tx, error3)

      tx.end()

      t.equal(errorAggr.traceAggregator.errors.length, 2)

      const transactionErrorMetric
        = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      t.equal(transactionErrorMetric.callCount, 2)

      t.equal(allErrorMetric.callCount, 2)
      t.equal(webErrorMetric.callCount, 2)
      t.notOk(otherErrorMetric)

      t.end()
    })
  })

  t.test('Ignore status code should result in 0 errors reported', (t) => {
    helper.runInTransaction(agent, function(tx) {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_status_codes = [500]
      tx.statusCode = 500

      const error1 = new Error('ignore')
      const error2 = new Error('ignore me too')
      const error3 = new ReferenceError('i will also be ignored')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      errorAggr.add(tx, error3)

      tx.end()

      t.equal(errorAggr.traceAggregator.errors.length, 0)

      const transactionErrorMetric
        = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      t.notOk(transactionErrorMetric)

      t.notOk(allErrorMetric)
      t.notOk(webErrorMetric)
      t.notOk(otherErrorMetric)

      t.end()
    })
  })

  t.test('Ignore status code should ignore when status set after collecting errors', (t) => {
    helper.runInTransaction(agent, function(tx) {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_status_codes = [500]

      const error1 = new Error('ignore')
      const error2 = new Error('ignore me too')
      const error3 = new ReferenceError('i will also be ignored')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      errorAggr.add(tx, error3)

      // important: set code after collecting errors for test case
      tx.statusCode = 500
      tx.end()

      t.equal(errorAggr.traceAggregator.errors.length, 0)

      const transactionErrorMetric
        = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      t.notOk(transactionErrorMetric)

      t.notOk(allErrorMetric)
      t.notOk(webErrorMetric)
      t.notOk(otherErrorMetric)

      t.end()
    })
  })

  t.test('Ignore status code should trump expected status code', (t) => {
    helper.runInTransaction(agent, function(tx) {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_status_codes = [500]
      agent.config.error_collector.expected_status_codes = [500]
      tx.statusCode = 500

      const error1 = new Error('ignore')
      const error2 = new Error('also ignore')
      const error3 = new ReferenceError('i will also be ignored')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      errorAggr.add(tx, error3)

      tx.end()

      t.equal(errorAggr.traceAggregator.errors.length, 0)

      const transactionErrorMetric
        = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      t.notOk(transactionErrorMetric)

      t.notOk(allErrorMetric)
      t.notOk(webErrorMetric)
      t.notOk(otherErrorMetric)

      t.end()
    })
  })
})
