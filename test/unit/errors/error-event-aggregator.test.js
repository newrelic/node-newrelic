/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const expect = require('chai').expect
const ErrorEventAggregator = require('../../../lib/errors/error-event-aggregator')
const Metrics = require('../../../lib/metrics')

const RUN_ID = 1337
const LIMIT = 5

describe('Error Event Aggregator', () => {
  let errorEventAggregator

  beforeEach(() => {
    errorEventAggregator = new ErrorEventAggregator(
      {
        runId: RUN_ID,
        limit: LIMIT
      },
      {},
      new Metrics(5, {}, {})
    )
  })

  afterEach(() => {
    errorEventAggregator = null
  })

  it('should set the correct default method', () => {
    const method = errorEventAggregator.method

    expect(method).to.equal('error_event_data')
  })

  it('toPayload() should return json format of data', () => {
    const expectedMetrics = {
      reservoir_size: LIMIT,
      events_seen: 1
    }

    const rawErrorEvent = [{ 'type': 'TransactionError', 'error.class': 'class' }, {}, {}]

    errorEventAggregator.add(rawErrorEvent)

    const payload = errorEventAggregator._toPayloadSync()
    expect(payload.length).to.equal(3)

    const [runId, eventMetrics, errorEventData] = payload

    expect(runId).to.equal(RUN_ID)
    expect(eventMetrics).to.deep.equal(expectedMetrics)
    expect(errorEventData).to.deep.equal([rawErrorEvent])
  })

  it('toPayload() should return nothing with no error event data', () => {
    const payload = errorEventAggregator._toPayloadSync()

    expect(payload).to.not.exist
  })
})
