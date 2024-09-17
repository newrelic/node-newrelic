/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const TransactionEventAggregator = require('../../lib/transaction/transaction-event-aggregator')
const Metrics = require('../../lib/metrics')

const RUN_ID = 1337
const LIMIT = 5
const EXPECTED_METHOD = 'analytic_event_data'
const SPLIT_THRESHOLD = 3

function beforeEach(ctx) {
  const fakeCollectorApi = { send: sinon.stub() }
  const fakeHarvester = { add: sinon.stub() }

  ctx.nr = {}
  ctx.nr.eventAggregator = new TransactionEventAggregator(
    {
      runId: RUN_ID,
      limit: LIMIT,
      splitThreshold: SPLIT_THRESHOLD
    },
    {
      collector: fakeCollectorApi,
      harvester: fakeHarvester,
      metrics: new Metrics(5, {}, {})
    }
  )
  ctx.nr.fakeCollectorApi = fakeCollectorApi
}

test('Transaction Event Aggregator', async (t) => {
  t.beforeEach(beforeEach)

  await t.test('should set the correct default method', (t) => {
    const { eventAggregator } = t.nr
    const method = eventAggregator.method

    assert.equal(method, EXPECTED_METHOD)
  })

  await t.test('toPayload() should return json format of data', (t) => {
    const { eventAggregator } = t.nr
    const expectedMetrics = {
      reservoir_size: LIMIT,
      events_seen: 1
    }

    const rawEvent = [{ type: 'Transaction', error: false }, { foo: 'bar' }]

    eventAggregator.add(rawEvent)

    const payload = eventAggregator._toPayloadSync()
    assert.equal(payload.length, 3)

    const [runId, eventMetrics, eventData] = payload

    assert.equal(runId, RUN_ID)
    assert.deepEqual(eventMetrics, expectedMetrics)
    assert.deepEqual(eventData, [rawEvent])
  })

  await t.test('toPayload() should return nothing with no event data', (t) => {
    const { eventAggregator } = t.nr
    const payload = eventAggregator._toPayloadSync()

    assert.equal(payload, null)
  })
})

test('Transaction Event Aggregator - when data over split threshold', async (t) => {
  t.beforeEach((t) => {
    beforeEach(t)
    const { eventAggregator } = t.nr
    eventAggregator.add([{ type: 'Transaction', error: false }, { num: 1 }])
    eventAggregator.add([{ type: 'Transaction', error: false }, { num: 2 }])
    eventAggregator.add([{ type: 'Transaction', error: false }, { num: 3 }])
    eventAggregator.add([{ type: 'Transaction', error: false }, { num: 4 }])
    eventAggregator.add([{ type: 'Transaction', error: false }, { num: 5 }])
  })

  await t.test('should emit proper message with method for starting send', (t, end) => {
    const { eventAggregator } = t.nr
    const expectedStartEmit = `starting_data_send-${EXPECTED_METHOD}`

    eventAggregator.once(expectedStartEmit, end)

    eventAggregator.send()
  })

  await t.test('should clear existing data', (t) => {
    const { eventAggregator } = t.nr
    eventAggregator.send()

    assert.equal(eventAggregator.events.length, 0)
  })

  await t.test('should call transport for two payloads', (t) => {
    const { eventAggregator, fakeCollectorApi } = t.nr
    const payloads = []

    fakeCollectorApi.send.callsFake((_method, payload, callback) => {
      payloads.push(payload)

      // Needed for both to invoke
      callback(null, { retainData: false })
    })

    eventAggregator.send()

    assert.equal(payloads.length, 2)

    const [firstPayload, secondPayload] = payloads

    const [firstRunId, firstMetrics, firstEventData] = firstPayload
    assert.equal(firstRunId, RUN_ID)
    assert.deepEqual(firstMetrics, {
      reservoir_size: 2,
      events_seen: 2
    })
    assert.equal(firstEventData.length, 2)

    const [secondRunId, secondMetrics, secondEventData] = secondPayload
    assert.equal(secondRunId, RUN_ID)
    assert.deepEqual(secondMetrics, {
      reservoir_size: 3,
      events_seen: 3
    })
    assert.equal(secondEventData.length, 3)
  })

  await t.test('should call merge with original data when transport indicates retain', (t) => {
    const { eventAggregator, fakeCollectorApi } = t.nr
    const originalData = eventAggregator._getMergeData()

    fakeCollectorApi.send.callsFake((_method, _payload, callback) => {
      callback(null, { retainData: true })
    })

    eventAggregator.send()

    const currentData = eventAggregator._getMergeData()
    assert.equal(currentData.length, originalData.length)

    const originalEvents = originalData.toArray().sort(sortEventsByNum)
    const currentEvents = currentData.toArray().sort(sortEventsByNum)

    assert.deepEqual(currentEvents, originalEvents)
  })

  await t.test('should not merge when transport indicates not to retain', (t) => {
    const { eventAggregator, fakeCollectorApi } = t.nr
    fakeCollectorApi.send.callsFake((_method, _payload, callback) => {
      callback(null, { retainData: false })
    })

    eventAggregator.send()

    const currentData = eventAggregator._getMergeData()

    assert.equal(currentData.length, 0)
  })

  await t.test('should handle payload retain values individually', (t) => {
    const { eventAggregator, fakeCollectorApi } = t.nr
    let payloadCount = 0
    let payloadToRetain = null
    fakeCollectorApi.send.callsFake((_method, payload, callback) => {
      payloadCount++

      const shouldRetain = payloadCount > 1
      if (shouldRetain) {
        payloadToRetain = payload
      }

      callback(null, { retainData: shouldRetain })
    })

    eventAggregator.send()

    const eventsToRetain = payloadToRetain[2].sort(sortEventsByNum)

    const currentData = eventAggregator._getMergeData()
    assert.equal(currentData.length, eventsToRetain.length)

    const currentEvents = currentData.toArray().sort(sortEventsByNum)
    assert.deepEqual(currentEvents, eventsToRetain)
  })

  await t.test('should emit proper message with method for finishing send', (t, end) => {
    const { eventAggregator, fakeCollectorApi } = t.nr
    const expectedEndEmit = `finished_data_send-${EXPECTED_METHOD}`

    eventAggregator.once(expectedEndEmit, end)

    fakeCollectorApi.send.callsFake((_method, _payload, callback) => {
      callback(null, { retainData: false })
    })

    eventAggregator.send()
  })
})

function sortEventsByNum(event1, event2) {
  const num1 = event1[1].num
  const num2 = event2[1].num
  return num1 - num2
}
