'use strict'

const expect = require('chai').expect
const TransactionEventAggregator =
  require('../../lib/transaction/transaction-event-aggregator')
const Metrics = require('../../lib/metrics')

const RUN_ID = 1337
const LIMIT = 5
const EXPECTED_METHOD = 'analytic_event_data'

describe('Transaction Event Aggregator', () => {
  let eventAggregator

  beforeEach(() => {
    eventAggregator = new TransactionEventAggregator({
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

  it('toPayload() should return json format of data', () => {
    const expectedMetrics = {
      reservoir_size: LIMIT,
      events_seen: 1
    }

    const rawEvent = [{type: 'Transaction', error: false}, {foo: 'bar'}]

    eventAggregator.add(rawEvent)

    const payload = eventAggregator.toPayload()
    expect(payload.length).to.equal(3)

    const [runId, eventMetrics, eventData] = payload

    expect(runId).to.equal(RUN_ID)
    expect(eventMetrics).to.deep.equal(expectedMetrics)
    expect(eventData).to.deep.equal([rawEvent])
  })
})
