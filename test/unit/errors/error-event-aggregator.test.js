/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const ErrorEventAggregator = require('../../../lib/errors/error-event-aggregator')
const Metrics = require('../../../lib/metrics')
const sinon = require('sinon')

const RUN_ID = 1337
const LIMIT = 5

tap.test('Error Event Aggregator', (t) => {
  t.autoend()
  let errorEventAggregator

  t.beforeEach(() => {
    errorEventAggregator = new ErrorEventAggregator(
      {
        config: { error_collector: { enabled: true, capture_events: true } },
        runId: RUN_ID,
        limit: LIMIT,
        enabled: (config) => config.error_collector.enabled && config.error_collector.capture_events
      },
      {
        collector: {},
        metrics: new Metrics(5, {}, {}),
        harvester: { add: sinon.stub() }
      }
    )
    sinon.stub(errorEventAggregator, 'stop')
  })

  t.afterEach(() => {
    errorEventAggregator = null
  })

  t.test('should set the correct default method', (t) => {
    const method = errorEventAggregator.method

    t.equal(method, 'error_event_data', 'default method should be error_event_data')
    t.end()
  })

  t.test('toPayload() should return json format of data', (t) => {
    const expectedMetrics = {
      reservoir_size: LIMIT,
      events_seen: 1
    }

    const rawErrorEvent = [{ 'type': 'TransactionError', 'error.class': 'class' }, {}, {}]

    errorEventAggregator.add(rawErrorEvent)

    const payload = errorEventAggregator._toPayloadSync()
    t.equal(payload.length, 3, 'payload length should be 3')

    const [runId, eventMetrics, errorEventData] = payload

    t.equal(runId, RUN_ID)
    t.same(eventMetrics, expectedMetrics)
    t.same(errorEventData, [rawErrorEvent])
    t.end()
  })

  t.test('toPayload() should return nothing with no error event data', (t) => {
    const payload = errorEventAggregator._toPayloadSync()

    t.notOk(payload)
    t.end()
  })
  ;[
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
  ].forEach(({ config, msg, callCount }) => {
    t.test(`${msg} if ${JSON.stringify(config)}`, (t) => {
      const newConfig = { getAggregatorConfig: sinon.stub(), run_id: 1, ...config }
      t.ok(errorEventAggregator.enabled)
      errorEventAggregator.reconfigure(newConfig)
      t.equal(errorEventAggregator.stop.callCount, callCount, msg)
      t.end()
    })
  })
})
