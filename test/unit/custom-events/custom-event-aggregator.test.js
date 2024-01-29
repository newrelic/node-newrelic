/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const CustomEventAggregator = require('../../../lib/custom-events/custom-event-aggregator')
const Metrics = require('../../../lib/metrics')
const NAMES = require('../../../lib/metrics/names')
const sinon = require('sinon')

const RUN_ID = 1337
const LIMIT = 5
const EXPECTED_METHOD = 'custom_event_data'

tap.test('Custom Event Aggregator', (t) => {
  t.autoend()
  let eventAggregator

  t.beforeEach(() => {
    eventAggregator = new CustomEventAggregator(
      {
        runId: RUN_ID,
        limit: LIMIT,
        metricNames: NAMES.CUSTOM_EVENTS
      },
      {
        collector: {},
        metrics: new Metrics(5, {}, {}),
        harvester: { add: sinon.stub() }
      }
    )
  })

  t.afterEach(() => {
    eventAggregator = null
  })

  t.test('should set the correct default method', (t) => {
    const method = eventAggregator.method

    t.equal(method, EXPECTED_METHOD)
    t.end()
  })

  t.test('toPayloadSync() should return json format of data', (t) => {
    const rawEvent = [{ type: 'Custom' }, { foo: 'bar' }]

    eventAggregator.add(rawEvent)

    const payload = eventAggregator._toPayloadSync()
    t.equal(payload.length, 2)

    const [runId, eventData] = payload

    t.equal(runId, RUN_ID)
    t.same(eventData, [rawEvent])
    t.end()
  })

  t.test('toPayloadSync() should return nothing with no event data', (t) => {
    const payload = eventAggregator._toPayloadSync()

    t.notOk(payload)
    t.end()
  })
})
