/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const ErrorTraceAggregator = require('../../../lib/errors/error-trace-aggregator')

const RUN_ID = 1337
const LIMIT = 5

test('Error Trace Aggregator', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.errorTraceAggregator = new ErrorTraceAggregator(
      {
        config: { collect_errors: true, error_collector: { enabled: true } },
        runId: RUN_ID,
        limit: LIMIT,
        enabled(config) {
          return config.error_collector.enabled && config.collect_errors
        }
      },
      {},
      { add() {} }
    )

    ctx.nr.stopped = 0
    ctx.nr.errorTraceAggregator.stop = () => {
      ctx.nr.stopped += 1
    }
  })

  await t.test('should set the correct default method', (t) => {
    const { errorTraceAggregator } = t.nr
    assert.equal(errorTraceAggregator.method, 'error_data', 'default method should be error_data')
  })

  await t.test('add() should add error', (t) => {
    const { errorTraceAggregator } = t.nr
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const firstError = errorTraceAggregator.errors[0]
    assert.equal(rawErrorTrace, firstError)
  })

  await t.test('_getMergeData() should return errors', (t) => {
    const { errorTraceAggregator } = t.nr
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const data = errorTraceAggregator._getMergeData()
    assert.equal(data.length, 1, 'there should be one error')

    const firstError = data[0]
    assert.equal(rawErrorTrace, firstError, '_getMergeData should return the expected error trace')
  })

  await t.test('toPayloadSync() should return json format of data', (t) => {
    const { errorTraceAggregator } = t.nr
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const payload = errorTraceAggregator._toPayloadSync()
    assert.equal(payload.length, 2, 'sync payload should have runId and errorTraceData')

    const [runId, errorTraceData] = payload
    assert.equal(runId, RUN_ID, 'run ID should match')

    const expectedTraceData = [rawErrorTrace]
    assert.deepEqual(errorTraceData, expectedTraceData, 'errorTraceData should match')
  })

  await t.test('toPayload() should return json format of data', (t, end) => {
    const { errorTraceAggregator } = t.nr
    const rawErrorTrace = [0, 'name', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    errorTraceAggregator._toPayload((err, payload) => {
      assert.ifError(err)
      assert.equal(payload.length, 2, 'payload should have two elements')

      const [runId, errorTraceData] = payload
      assert.equal(runId, RUN_ID, 'run ID should match')

      const expectedTraceData = [rawErrorTrace]
      assert.deepEqual(errorTraceData, expectedTraceData, 'errorTraceData should match')
      end()
    })
  })

  await t.test('_merge() should merge passed-in data in order', (t) => {
    const { errorTraceAggregator } = t.nr
    const rawErrorTrace = [0, 'name1', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    const mergeData = [
      [0, 'name2', 'message', 'type', {}],
      [0, 'name3', 'message', 'type', {}]
    ]

    errorTraceAggregator._merge(mergeData)

    assert.equal(errorTraceAggregator.errors.length, 3, 'aggregator should have three errors')

    const [error1, error2, error3] = errorTraceAggregator.errors
    assert.equal(error1[1], 'name1', 'error1 should have expected name')
    assert.equal(error2[1], 'name2', 'error2 should have expected name')
    assert.equal(error3[1], 'name3', 'error3 should have expected name')
  })

  await t.test('_merge() should not merge past limit', (t) => {
    const { errorTraceAggregator } = t.nr
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

    assert.equal(
      errorTraceAggregator.errors.length,
      LIMIT,
      'aggregator should have received five errors'
    )

    const [error1, error2, error3, error4, error5] = errorTraceAggregator.errors
    assert.equal(error1[1], 'name1', 'error1 should have expected name')
    assert.equal(error2[1], 'name2', 'error2 should have expected name')
    assert.equal(error3[1], 'name3', 'error3 should have expected name')
    assert.equal(error4[1], 'name4', 'error4 should have expected name')
    assert.equal(error5[1], 'name5', 'error5 should have expected name')
  })

  await t.test('clear() should clear errors', (t) => {
    const { errorTraceAggregator } = t.nr
    const rawErrorTrace = [0, 'name1', 'message', 'type', {}]
    errorTraceAggregator.add(rawErrorTrace)

    assert.equal(
      errorTraceAggregator.errors.length,
      1,
      'before clear(), there should be one error in the aggregator'
    )

    errorTraceAggregator.clear()

    assert.equal(
      errorTraceAggregator.errors.length,
      0,
      'after clear(), there should be nothing in the aggregator'
    )
  })

  const methodTests = [
    {
      callCount: 1,
      msg: 'should stop aggregator',
      config: { collect_errors: true, error_collector: { enabled: false } }
    },
    {
      callCount: 1,
      msg: 'should stop aggregator',
      config: { collect_errors: false, error_collector: { enabled: true } }
    },
    {
      callCount: 0,
      msg: 'should not stop aggregator',
      config: { collect_errors: true, error_collector: { enabled: true } }
    }
  ]
  for (const methodTest of methodTests) {
    const { callCount, config, msg } = methodTest
    await t.test(`${msg} if ${JSON.stringify(config)}`, (t) => {
      const { errorTraceAggregator } = t.nr
      const newConfig = { getAggregatorConfig() {}, run_id: 1, ...config }
      assert.equal(errorTraceAggregator.enabled, true)
      errorTraceAggregator.reconfigure(newConfig)
      assert.equal(t.nr.stopped, callCount, msg)
    })
  }
})
