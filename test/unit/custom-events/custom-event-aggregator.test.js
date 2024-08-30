/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const CustomEventAggregator = require('../../../lib/custom-events/custom-event-aggregator')
const Metrics = require('../../../lib/metrics')
const NAMES = require('../../../lib/metrics/names')
const sinon = require('sinon')

const RUN_ID = 1337
const LIMIT = 5
const EXPECTED_METHOD = 'custom_event_data'

test('Custom Event Aggregator', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.eventAggregator = new CustomEventAggregator(
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

  t.afterEach((ctx) => {
    ctx.nr.eventAggregator = null
  })

  await t.test('should set the correct default method', (ctx) => {
    const { eventAggregator } = ctx.nr
    const method = eventAggregator.method
    assert.equal(method, EXPECTED_METHOD)
  })

  await t.test('toPayloadSync() should return json format of data', (ctx) => {
    const { eventAggregator } = ctx.nr
    const rawEvent = [{ type: 'Custom' }, { foo: 'bar' }]

    eventAggregator.add(rawEvent)

    const payload = eventAggregator._toPayloadSync()
    assert.equal(payload.length, 2)

    const [runId, eventData] = payload

    assert.equal(runId, RUN_ID)
    assert.deepStrictEqual(eventData, [rawEvent])
  })

  await t.test('toPayloadSync() should return nothing with no event data', (ctx) => {
    const { eventAggregator } = ctx.nr
    const payload = eventAggregator._toPayloadSync()
    assert.equal(payload, null)
  })
})
