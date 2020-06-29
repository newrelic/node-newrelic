/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const expect = require('chai').expect
const TransactionEventAggregator =
  require('../../lib/transaction/transaction-event-aggregator')
const Metrics = require('../../lib/metrics')

const RUN_ID = 1337
const LIMIT = 5
const EXPECTED_METHOD = 'analytic_event_data'
const SPLIT_THRESHOLD = 3

describe('Transaction Event Aggregator', () => {
  let eventAggregator
  let fakeCollectorApi = null

  beforeEach(() => {
    fakeCollectorApi = {}
    fakeCollectorApi[EXPECTED_METHOD] = () => {}

    eventAggregator = new TransactionEventAggregator(
      {
        runId: RUN_ID,
        limit: LIMIT,
        splitThreshold: SPLIT_THRESHOLD
      },
      fakeCollectorApi,
      new Metrics(5, {}, {})
    )
  })

  afterEach(() => {
    eventAggregator = null
  })

  it('should set the correct default method', () => {
    const method = eventAggregator.method

    expect(method).to.equal(EXPECTED_METHOD)
  })

  it('toPayload() should return json format of data', () => {
    const expectedMetrics = {
      reservoir_size: LIMIT,
      events_seen: 1
    }

    const rawEvent = [{type: 'Transaction', error: false}, {foo: 'bar'}]

    eventAggregator.add(rawEvent)

    const payload = eventAggregator._toPayloadSync()
    expect(payload.length).to.equal(3)

    const [runId, eventMetrics, eventData] = payload

    expect(runId).to.equal(RUN_ID)
    expect(eventMetrics).to.deep.equal(expectedMetrics)
    expect(eventData).to.deep.equal([rawEvent])
  })

  it('toPayload() should return nothing with no event data', () => {
    const payload = eventAggregator._toPayloadSync()

    expect(payload).to.not.exist
  })

  describe('when data over split threshold', () => {
    beforeEach(() => {
      eventAggregator.add([{type: 'Transaction', error: false}, {num: 1}])
      eventAggregator.add([{type: 'Transaction', error: false}, {num: 2}])
      eventAggregator.add([{type: 'Transaction', error: false}, {num: 3}])
      eventAggregator.add([{type: 'Transaction', error: false}, {num: 4}])
      eventAggregator.add([{type: 'Transaction', error: false}, {num: 5}])
    })

    describe('send()', () => {
      it('should emit proper message with method for starting send', () => {
        const expectedStartEmit = `starting ${EXPECTED_METHOD} data send.`

        let emitFired = false
        eventAggregator.once(expectedStartEmit, () => {
          emitFired = true
        })

        eventAggregator.send()

        expect(emitFired).to.be.true
      })

      it('should clear existing data', () => {
        eventAggregator.send()

        expect(eventAggregator.events.length).to.equal(0)
      })

      it('should call transport for two payloads', () => {
        const payloads = []

        fakeCollectorApi[EXPECTED_METHOD] = (payload, callback) => {
          payloads.push(payload)

          // Needed for both to invoke
          callback(null, {retainData: false})
        }

        eventAggregator.send()

        expect(payloads.length).to.equal(2)

        const [firstPayload, secondPayload] = payloads

        const [firstRunId, firstMetrics, firstEventData] = firstPayload
        expect(firstRunId).to.equal(RUN_ID)
        expect(firstMetrics).to.deep.equal({
          reservoir_size: 2,
          events_seen: 2
        })
        expect(firstEventData.length).to.equal(2)

        const [secondRunId, secondMetrics, secondEventData] = secondPayload
        expect(secondRunId).to.equal(RUN_ID)
        expect(secondMetrics).to.deep.equal({
          reservoir_size: 3,
          events_seen: 3
        })
        expect(secondEventData.length).to.equal(3)
      })

      it('should call merge with original data when transport indicates retain', () => {
        const originalData = eventAggregator._getMergeData()

        fakeCollectorApi[EXPECTED_METHOD] = (payload, callback) => {
          callback(null, {retainData: true})
        }

        eventAggregator.send()

        const currentData = eventAggregator._getMergeData()
        expect(currentData.length).to.equal(originalData.length)

        const originalEvents = originalData.toArray().sort(sortEventsByNum)
        const currentEvents = currentData.toArray().sort(sortEventsByNum)

        expect(currentEvents).to.deep.equal(originalEvents)
      })

      it('should not merge when transport indicates not to retain', () => {
        fakeCollectorApi[EXPECTED_METHOD] = (payload, callback) => {
          callback(null, {retainData: false})
        }

        eventAggregator.send()

        const currentData = eventAggregator._getMergeData()

        expect(currentData.length).to.equal(0)
      })

      it('should handle payload retain values individually', () => {
        let payloadCount = 0
        let payloadToRetain = null
        fakeCollectorApi[EXPECTED_METHOD] = (payload, callback) => {
          payloadCount++

          const shouldRetain = payloadCount > 1
          if (shouldRetain) {
            payloadToRetain = payload
          }

          callback(null, {retainData: shouldRetain})
        }

        eventAggregator.send()

        const eventsToRetain = payloadToRetain[2].sort(sortEventsByNum)

        const currentData = eventAggregator._getMergeData()
        expect(currentData.length).to.equal(eventsToRetain.length)

        const currentEvents = currentData.toArray().sort(sortEventsByNum)

        expect(currentEvents).to.deep.equal(eventsToRetain)
      })

      it('should emit proper message with method for finishing send', () => {
        const expectedStartEmit = `finished ${EXPECTED_METHOD} data send.`

        let emitFired = false
        eventAggregator.once(expectedStartEmit, () => {
          emitFired = true
        })

        fakeCollectorApi[EXPECTED_METHOD] = (payload, callback) => {
          callback(null, { retainData: false})
        }

        eventAggregator.send()

        expect(emitFired).to.be.true
      })
    })
  })
})

function sortEventsByNum(event1, event2) {
  const num1 = event1[1].num
  const num2 = event2[1].num
  return num1 - num2
}
