/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const expect = require('chai').expect
const CustomEventAggregator =
  require('../../../lib/custom-events/custom-event-aggregator')
const Metrics = require('../../../lib/metrics')

const RUN_ID = 1337
const LIMIT = 5
const EXPECTED_METHOD = 'custom_event_data'

describe('Custom Event Aggregator', () => {
  let eventAggregator

  beforeEach(() => {
    eventAggregator = new CustomEventAggregator({
      runId: RUN_ID,
      limit: LIMIT
    }, {}, new Metrics(5, {}, {}))
  })

  afterEach(() => {
    eventAggregator = null
  })

  it('should set the correct default method', () => {
    const method = eventAggregator.method

    expect(method).to.equal(EXPECTED_METHOD)
  })

  it('toPayloadSync() should return json format of data', () => {
    const rawEvent = [{type: 'Custom'}, {foo: 'bar'}]

    eventAggregator.add(rawEvent)

    const payload = eventAggregator._toPayloadSync()
    expect(payload.length).to.equal(2)

    const [runId, eventData] = payload

    expect(runId).to.equal(RUN_ID)
    expect(eventData).to.deep.equal([rawEvent])
  })

  it('toPayloadSync() should return nothing with no event data', () => {
    const payload = eventAggregator._toPayloadSync()

    expect(payload).to.not.exist
  })
})
