/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const NAMES = require('../../../lib/metrics/names')

test('Ignored Errors', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('Ignore Classes should result in no error reported', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_classes = ['Error']

      const error1 = Error('ignored')
      const error2 = new ReferenceError('NOT ignored')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      tx.end()

      assert.equal(errorAggr.traceAggregator.errors.length, 1)

      const transactionErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      assert.equal(transactionErrorMetric.callCount, 1)

      assert.equal(allErrorMetric.callCount, 1)
      assert.equal(webErrorMetric.callCount, 1)

      assert.equal(otherErrorMetric, undefined)

      end()
    })
  })

  await t.test('Ignore Classes should trump expected classes', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_classes = ['Error']
      agent.config.error_collector.expected_classes = ['Error']

      const error1 = Error('ignored')
      const error2 = new ReferenceError('NOT ignored')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      tx.end()

      assert.equal(errorAggr.traceAggregator.errors.length, 1)

      const transactionErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      assert.equal(transactionErrorMetric.callCount, 1)

      assert.equal(allErrorMetric.callCount, 1)
      assert.equal(webErrorMetric.callCount, 1)
      assert.equal(otherErrorMetric, undefined)

      end()
    })
  })

  await t.test('Ignore messages should result in no error reported', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_messages = { Error: ['ignored'] }

      const error1 = Error('ignored')
      const error2 = Error('not ignored')
      const error3 = new ReferenceError('not ignored')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      errorAggr.add(tx, error3)

      tx.end()

      assert.equal(errorAggr.traceAggregator.errors.length, 2)

      const transactionErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      assert.equal(transactionErrorMetric.callCount, 2)

      assert.equal(allErrorMetric.callCount, 2)
      assert.equal(webErrorMetric.callCount, 2)
      assert.equal(otherErrorMetric, undefined)

      end()
    })
  })

  await t.test('Ignore messages should trump expected_messages', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_messages = { Error: ['ignore'] }
      agent.config.error_collector.expected_messages = { Error: ['ignore'] }

      const error1 = Error('ignore')
      const error2 = Error('not ignore')
      const error3 = new ReferenceError('not ignore')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      errorAggr.add(tx, error3)

      tx.end()

      assert.equal(errorAggr.traceAggregator.errors.length, 2)

      const transactionErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      assert.equal(transactionErrorMetric.callCount, 2)

      assert.equal(allErrorMetric.callCount, 2)
      assert.equal(webErrorMetric.callCount, 2)
      assert.equal(otherErrorMetric, undefined)

      end()
    })
  })

  await t.test('Ignore status code should result in 0 errors reported', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_status_codes = [500]
      tx.statusCode = 500

      const error1 = Error('ignore')
      const error2 = Error('ignore me too')
      const error3 = new ReferenceError('i will also be ignored')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      errorAggr.add(tx, error3)

      tx.end()

      assert.equal(errorAggr.traceAggregator.errors.length, 0)

      const transactionErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      assert.equal(transactionErrorMetric, undefined)

      assert.equal(allErrorMetric, undefined)
      assert.equal(webErrorMetric, undefined)
      assert.equal(otherErrorMetric, undefined)

      end()
    })
  })

  await t.test(
    'Ignore status code should ignore when status set after collecting errors',
    (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (tx) => {
        const errorAggr = agent.errors
        agent.config.error_collector.capture_events = true
        agent.config.error_collector.ignore_status_codes = [500]

        const error1 = Error('ignore')
        const error2 = Error('ignore me too')
        const error3 = new ReferenceError('i will also be ignored')

        errorAggr.add(tx, error1)
        errorAggr.add(tx, error2)
        errorAggr.add(tx, error3)

        // important: set code after collecting errors for test case
        tx.statusCode = 500
        tx.end()

        assert.equal(errorAggr.traceAggregator.errors.length, 0)

        const transactionErrorMetric = agent.metrics.getMetric(
          NAMES.ERRORS.PREFIX + tx.getFullName()
        )

        const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
        const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
        const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

        assert.equal(transactionErrorMetric, undefined)

        assert.equal(allErrorMetric, undefined)
        assert.equal(webErrorMetric, undefined)
        assert.equal(otherErrorMetric, undefined)

        end()
      })
    }
  )

  await t.test('Ignore status code should trump expected status code', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const errorAggr = agent.errors
      agent.config.error_collector.capture_events = true
      agent.config.error_collector.ignore_status_codes = [500]
      agent.config.error_collector.expected_status_codes = [500]
      tx.statusCode = 500

      const error1 = Error('ignore')
      const error2 = Error('also ignore')
      const error3 = new ReferenceError('i will also be ignored')

      errorAggr.add(tx, error1)
      errorAggr.add(tx, error2)
      errorAggr.add(tx, error3)

      tx.end()

      assert.equal(errorAggr.traceAggregator.errors.length, 0)

      const transactionErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.PREFIX + tx.getFullName())

      const allErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.ALL)
      const webErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.WEB)
      const otherErrorMetric = agent.metrics.getMetric(NAMES.ERRORS.OTHER)

      assert.equal(transactionErrorMetric, undefined)

      assert.equal(allErrorMetric, undefined)
      assert.equal(webErrorMetric, undefined)
      assert.equal(otherErrorMetric, undefined)

      end()
    })
  })
})
