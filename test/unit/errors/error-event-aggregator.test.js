/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const ErrorEventAggregator = require('../../../lib/errors/error-event-aggregator')
const Metrics = require('../../../lib/metrics')

const RUN_ID = 1337
const LIMIT = 5

test('Error Event Aggregator', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.errorEventAggregator = new ErrorEventAggregator(
      {
        config: { error_collector: { enabled: true, capture_events: true } },
        runId: RUN_ID,
        limit: LIMIT,
        enabled(config) {
          return config.error_collector.enabled && config.error_collector.capture_events
        }
      },
      {
        collector: {},
        metrics: new Metrics(5, {}, {}),
        harvester: { add() {} }
      }
    )

    ctx.nr.stopped = 0
    ctx.nr.errorEventAggregator.stop = () => {
      ctx.nr.stopped += 1
    }
  })

  await t.test('should set the correct default method', (t) => {
    const { errorEventAggregator } = t.nr
    assert.equal(
      errorEventAggregator.method,
      'error_event_data',
      'default method should be error_event_data'
    )
  })

  await t.test('toPayload() should return json format of data', (t) => {
    const { errorEventAggregator } = t.nr
    const expectedMetrics = { reservoir_size: LIMIT, events_seen: 1 }
    const rawErrorEvent = [{ 'type': 'TransactionError', 'error.class': 'class' }, {}, {}]

    errorEventAggregator.add(rawErrorEvent)

    const payload = errorEventAggregator._toPayloadSync()
    assert.equal(payload.length, 3, 'payload length should be 3')

    const [runId, eventMetrics, errorEventData] = payload
    assert.equal(runId, RUN_ID)
    assert.deepEqual(eventMetrics, expectedMetrics)
    assert.deepEqual(errorEventData, [rawErrorEvent])
  })

  await t.test('toPayload() should return nothing with no error event data', (t) => {
    const { errorEventAggregator } = t.nr
    const payload = errorEventAggregator._toPayloadSync()
    assert.equal(payload, undefined)
  })

  const methodTests = [
    {
      callCount: 1,
      msg: 'should stop aggregator',
      config: { error_collector: { enabled: false, capture_events: true } }
    },
    {
      callCount: 1,
      msg: 'should stop aggregator',
      config: { error_collector: { enabled: true, capture_events: false } }
    },
    {
      callCount: 0,
      msg: 'should not stop aggregator',
      config: { error_collector: { enabled: true, capture_events: true } }
    }
  ]
  for (const methodTest of methodTests) {
    const { callCount, config, msg } = methodTest
    await t.test(`${msg} if ${JSON.stringify(config)}`, (t) => {
      const { errorEventAggregator } = t.nr
      const newConfig = { getAggregatorConfig() {}, run_id: 1, ...config }
      assert.equal(errorEventAggregator.enabled, true)
      errorEventAggregator.reconfigure(newConfig)
      assert.equal(t.nr.stopped, callCount, msg)
    })
  }
})
