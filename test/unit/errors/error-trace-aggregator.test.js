/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const ErrorTraceAggregator = require('../../../lib/errors/error-trace-aggregator')

const RUN_ID = 1337
const LIMIT = 5

tap.test('Error Trace Aggregator', (t) => {
  t.autoend()
  let errorTraceAggregator

  t.beforeEach(() => {
    errorTraceAggregator = new ErrorTraceAggregator({
      runId: RUN_ID,
      limit: LIMIT
    })
  })

  t.afterEach(() => {
    errorTraceAggregator = null
  })

  t.test('should set the correct default method', (t) => {
    const method = errorTraceAggregator.method

    t.equal(method, 'error_data', 'default method should be error_data')
    t.end()
  })

  t.test('add() should add errors', (t) => {
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const firstError = errorTraceAggregator.errors[0]
    t.equal(rawErrorTrace, firstError)
    t.end()
  })

  t.test('_getMergeData() should return errors', (t) => {
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const data = errorTraceAggregator._getMergeData()
    t.equal(data.length, 1, 'there should be one error')

    const firstError = data[0]
    t.equal(rawErrorTrace, firstError, '_getMergeData should return the expected error trace')
    t.end()
  })

  t.test('toPayloadSync() should return json format of data', (t) => {
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const payload = errorTraceAggregator._toPayloadSync()
    t.equal(payload.length, 2, 'sync payload should have runId and errorTraceData')

    const [runId, errorTraceData] = payload
    t.equal(runId, RUN_ID, 'run ID should match')

    const expectedTraceData = [rawErrorTrace]
    t.same(errorTraceData, expectedTraceData, 'errorTraceData should match')
    t.end()
  })

  t.test('toPayload() should return json format of data', (t) => {
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    errorTraceAggregator._toPayload((err, payload) => {
      t.equal(payload.length, 2, 'payload should have two elements')

      const [runId, errorTraceData] = payload
      t.equal(runId, RUN_ID, 'run ID should match')

      const expectedTraceData = [rawErrorTrace]
      t.same(errorTraceData, expectedTraceData, 'errorTraceData should match')
      t.end()
    })
  })

  t.test('_merge() should merge passed-in data in order', (t) => {
    const rawErrorTrace = [0, 'name1', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const mergeData = [
      [0, 'name2', 'message', 'type', {}],
      [0, 'name3', 'message', 'type', {}]
    ]

    errorTraceAggregator._merge(mergeData)

    t.equal(errorTraceAggregator.errors.length, 3, 'aggregator should have three errors')

    const [error1, error2, error3] = errorTraceAggregator.errors
    t.equal(error1[1], 'name1', 'error1 should have expected name')
    t.equal(error2[1], 'name2', 'error2 should have expected name')
    t.equal(error3[1], 'name3', 'error3 should have expected name')
    t.end()
  })

  t.test('_merge() should not merge past limit', (t) => {
    const rawErrorTrace = [0, 'name1', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const mergeData = [
      [0, 'name2', 'message', 'type', {}],
      [0, 'name3', 'message', 'type', {}],
      [0, 'name4', 'message', 'type', {}],
      [0, 'name5', 'message', 'type', {}],
      [0, 'name6', 'message', 'type', {}]
    ]

    errorTraceAggregator._merge(mergeData)

    t.equal(
      errorTraceAggregator.errors.length,
      LIMIT,
      'aggregator should have received five errors'
    )

    const [error1, error2, error3, error4, error5] = errorTraceAggregator.errors
    t.equal(error1[1], 'name1', 'error1 should have expected name')
    t.equal(error2[1], 'name2', 'error2 should have expected name')
    t.equal(error3[1], 'name3', 'error3 should have expected name')
    t.equal(error4[1], 'name4', 'error4 should have expected name')
    t.equal(error5[1], 'name5', 'error5 should have expected name')
    t.end()
  })

  t.test('clear() should clear errors', (t) => {
    const rawErrorTrace = [0, 'name1', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    t.equal(
      errorTraceAggregator.errors.length,
      1,
      'before clear(), there should be one error in the aggregator'
    )

    errorTraceAggregator.clear()

    t.equal(
      errorTraceAggregator.errors.length,
      0,
      'after clear(), there should be nothing in the aggregator'
    )
    t.end()
  })
})
