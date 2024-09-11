/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const sinon = require('sinon')
const TransactionEventAggregator = require('../../lib/transaction/transaction-event-aggregator')
const Metrics = require('../../lib/metrics')

const RUN_ID = 1337
const LIMIT = 5
const EXPECTED_METHOD = 'analytic_event_data'
const SPLIT_THRESHOLD = 3

function beforeEach(t) {
  const fakeCollectorApi = { send: sinon.stub() }
  const fakeHarvester = { add: sinon.stub() }

  t.context.eventAggregator = new TransactionEventAggregator(
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
  t.context.fakeCollectorApi = fakeCollectorApi
}

tap.test('Transaction Event Aggregator', (t) => {
  t.autoend()
  t.beforeEach(beforeEach)

  t.test('should set the correct default method', (t) => {
    const { eventAggregator } = t.context
    const method = eventAggregator.method

    t.equal(method, EXPECTED_METHOD)
    t.end()
  })

  t.test('toPayload() should return json format of data', (t) => {
    const { eventAggregator } = t.context
    const expectedMetrics = {
      reservoir_size: LIMIT,
      events_seen: 1
    }

    const rawEvent = [{ type: 'Transaction', error: false }, { foo: 'bar' }]

    eventAggregator.add(rawEvent)

    const payload = eventAggregator._toPayloadSync()
    t.equal(payload.length, 3)

    const [runId, eventMetrics, eventData] = payload

    t.equal(runId, RUN_ID)
    t.same(eventMetrics, expectedMetrics)
    t.same(eventData, [rawEvent])
    t.end()
  })

  t.test('toPayload() should return nothing with no event data', (t) => {
    const { eventAggregator } = t.context
    const payload = eventAggregator._toPayloadSync()

    t.notOk(payload)
    t.end()
  })
})

tap.test('Transaction Event Aggregator - when data over split threshold', (t) => {
  t.autoend()
  t.beforeEach((t) => {
    beforeEach(t)
    const { eventAggregator } = t.context
    eventAggregator.add([{ type: 'Transaction', error: false }, { num: 1 }])
    eventAggregator.add([{ type: 'Transaction', error: false }, { num: 2 }])
    eventAggregator.add([{ type: 'Transaction', error: false }, { num: 3 }])
    eventAggregator.add([{ type: 'Transaction', error: false }, { num: 4 }])
    eventAggregator.add([{ type: 'Transaction', error: false }, { num: 5 }])
  })

  t.test('should emit proper message with method for starting send', (t) => {
    const { eventAggregator } = t.context
    const expectedStartEmit = `starting_data_send-${EXPECTED_METHOD}`

    eventAggregator.once(expectedStartEmit, t.end)

    eventAggregator.send()
  })

  t.test('should clear existing data', (t) => {
    const { eventAggregator } = t.context
    eventAggregator.send()

    t.equal(eventAggregator.events.length, 0)
    t.end()
  })

  t.test('should call transport for two payloads', (t) => {
    const { eventAggregator, fakeCollectorApi } = t.context
    const payloads = []

    fakeCollectorApi.send.callsFake((_method, payload, callback) => {
      payloads.push(payload)

      // Needed for both to invoke
      callback(null, { retainData: false })
    })

    eventAggregator.send()

    t.equal(payloads.length, 2)

    const [firstPayload, secondPayload] = payloads

    const [firstRunId, firstMetrics, firstEventData] = firstPayload
    t.equal(firstRunId, RUN_ID)
    t.same(firstMetrics, {
      reservoir_size: 2,
      events_seen: 2
    })
    t.equal(firstEventData.length, 2)

    const [secondRunId, secondMetrics, secondEventData] = secondPayload
    t.equal(secondRunId, RUN_ID)
    t.same(secondMetrics, {
      reservoir_size: 3,
      events_seen: 3
    })
    t.equal(secondEventData.length, 3)
    t.end()
  })

  t.test('should call merge with original data when transport indicates retain', (t) => {
    const { eventAggregator, fakeCollectorApi } = t.context
    const originalData = eventAggregator._getMergeData()

    fakeCollectorApi.send.callsFake((_method, _payload, callback) => {
      callback(null, { retainData: true })
    })

    eventAggregator.send()

    const currentData = eventAggregator._getMergeData()
    t.equal(currentData.length, originalData.length)

    const originalEvents = originalData.toArray().sort(sortEventsByNum)
    const currentEvents = currentData.toArray().sort(sortEventsByNum)

    t.same(currentEvents, originalEvents)
    t.end()
  })

  t.test('should not merge when transport indicates not to retain', (t) => {
    const { eventAggregator, fakeCollectorApi } = t.context
    fakeCollectorApi.send.callsFake((_method, _payload, callback) => {
      callback(null, { retainData: false })
    })

    eventAggregator.send()

    const currentData = eventAggregator._getMergeData()

    t.equal(currentData.length, 0)
    t.end()
  })

  t.test('should handle payload retain values individually', (t) => {
    const { eventAggregator, fakeCollectorApi } = t.context
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
    t.equal(currentData.length, eventsToRetain.length)

    const currentEvents = currentData.toArray().sort(sortEventsByNum)

    t.same(currentEvents, eventsToRetain)
    t.end()
  })

  t.test('should emit proper message with method for finishing send', (t) => {
    const { eventAggregator, fakeCollectorApi } = t.context
    const expectedEndEmit = `finished_data_send-${EXPECTED_METHOD}`

    eventAggregator.once(expectedEndEmit, t.end)

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
