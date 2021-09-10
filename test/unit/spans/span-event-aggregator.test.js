/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')

const helper = require('../../lib/agent_helper')
const SpanEventAggregator = require('../../../lib/spans/span-event-aggregator')
const Metrics = require('../../../lib/metrics')

const RUN_ID = 1337
const DEFAULT_LIMIT = 2000
const MAX_LIMIT = 10000
const DEFAULT_PERIOD = 60000

tap.test('SpanAggregator', (t) => {
  t.autoend()

  let spanEventAggregator = null
  let agent = null

  t.beforeEach(() => {
    spanEventAggregator = new SpanEventAggregator(
      {
        runId: RUN_ID,
        limit: DEFAULT_LIMIT,
        periodMs: DEFAULT_PERIOD
      },
      {},
      new Metrics(5, {}, {})
    )
    agent = helper.instrumentMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
  })

  t.afterEach(() => {
    spanEventAggregator = null
    helper.unloadAgent(agent)
  })

  t.test('should set the correct default method', (t) => {
    const method = spanEventAggregator.method
    t.equal(method, 'span_event_data')

    t.end()
  })

  t.test('should add a span event from the given segment', (t) => {
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sample = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()

        t.equal(spanEventAggregator.length, 0)

        spanEventAggregator.addSegment(segment, 'p')
        t.equal(spanEventAggregator.length, 1)

        const event = spanEventAggregator.getEvents()[0]

        t.ok(event.intrinsics)
        t.equal(event.intrinsics.name, segment.name)
        t.equal(event.intrinsics.parentId, 'p')

        t.end()
      }, 10)
    })
  })

  t.test('should default the parent id', (t) => {
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sample = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()
        t.equal(spanEventAggregator.length, 0)

        spanEventAggregator.addSegment(segment)
        t.equal(spanEventAggregator.length, 1)

        const event = spanEventAggregator.getEvents()[0]

        t.ok(event.intrinsics)
        t.equal(event.intrinsics.name, segment.name)
        t.equal(event.intrinsics.parentId, null)

        t.notOk(event.intrinsics.grandparentId)

        t.end()
      }, 10)
    })
  })

  t.test('should indicate if the segment is accepted', (t) => {
    const METRIC_NAMES = {
      SEEN: '/SEEN',
      SENT: '/SENT',
      DROPPED: '/DROPPED'
    }

    const metrics = new Metrics(5, {}, {})

    spanEventAggregator = new SpanEventAggregator(
      {
        runId: RUN_ID,
        limit: 1,
        metricNames: METRIC_NAMES
      },
      {},
      metrics
    )

    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sample = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()

        t.equal(spanEventAggregator.length, 0)
        t.equal(spanEventAggregator.seen, 0)

        // First segment is added regardless of priority.
        t.equal(spanEventAggregator.addSegment(segment), true)
        t.equal(spanEventAggregator.length, 1)
        t.equal(spanEventAggregator.seen, 1)

        // Higher priority should be added.
        tx.priority = 100
        t.equal(spanEventAggregator.addSegment(segment), true)
        t.equal(spanEventAggregator.length, 1)
        t.equal(spanEventAggregator.seen, 2)
        const event1 = spanEventAggregator.getEvents()[0]

        // Lower priority should not be added.
        tx.priority = 1
        t.equal(spanEventAggregator.addSegment(segment), false)
        t.equal(spanEventAggregator.length, 1)
        t.equal(spanEventAggregator.seen, 3)
        const event2 = spanEventAggregator.getEvents()[0]

        const metric = metrics.getMetric(METRIC_NAMES.SEEN)

        t.equal(metric.callCount, 3)

        // Shouldn't change the event in the aggregator.
        t.equal(event1, event2)

        t.end()
      }, 10)
    })
  })

  t.test('_toPayloadSync() should return json format of data', (t) => {
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 1
      tx.sample = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()

        spanEventAggregator.addSegment(segment)

        const payload = spanEventAggregator._toPayloadSync()

        const [runId, metrics, events] = payload

        t.equal(runId, RUN_ID)

        t.ok(metrics.reservoir_size)
        t.ok(metrics.events_seen)
        t.equal(metrics.reservoir_size, DEFAULT_LIMIT)
        t.equal(metrics.events_seen, 1)

        t.ok(events[0])
        t.ok(events[0].intrinsics)
        t.equal(events[0].intrinsics.type, 'Span')

        t.end()
      }, 10)
    })
  })

  t.test('should use default value for periodMs', (t) => {
    const fakeConfig = {
      getAggregatorConfig: sinon.stub().returns(null),
      span_events: {
        max_samples_stored: DEFAULT_LIMIT
      }
    }
    spanEventAggregator.reconfigure(fakeConfig)
    t.equal(
      spanEventAggregator.periodMs,
      DEFAULT_PERIOD,
      `should default periodMs to ${DEFAULT_PERIOD}`
    )

    t.end()
  })

  t.test('should use default value for limit when user cleared', (t) => {
    const fakeConfig = {
      getAggregatorConfig: sinon.stub().returns(null),
      span_events: {
        enabled: true,
        max_samples_stored: ''
      }
    }

    spanEventAggregator.reconfigure(fakeConfig)

    t.equal(spanEventAggregator.limit, DEFAULT_LIMIT, `should default limit to ${DEFAULT_LIMIT}`)
    t.equal(
      spanEventAggregator._items.limit,
      DEFAULT_LIMIT,
      `should set queue limit to ${DEFAULT_LIMIT}`
    )
    t.end()
  })

  t.test('should use `span_event_harvest_config.report_period_ms` from server', (t) => {
    const fakeConfig = {
      span_event_harvest_config: {
        report_period_ms: 4000,
        harvest_limit: 1000
      },
      getAggregatorConfig: sinon.stub().returns(null),
      span_events: {
        max_samples_stored: DEFAULT_LIMIT
      }
    }
    spanEventAggregator.reconfigure(fakeConfig)

    t.equal(
      spanEventAggregator.periodMs,
      4000,
      `should use span_event_harvest_config.report_period_ms`
    )
    t.end()
  })

  t.test(`should use 'span_event_harvest_config.harvest_limit' from server`, (t) => {
    const fakeConfig = {
      span_event_harvest_config: {
        harvest_limit: 2000
      },
      getAggregatorConfig: sinon.stub().returns(null),
      span_events: {
        max_samples_stored: 3000
      }
    }
    spanEventAggregator.reconfigure(fakeConfig)
    t.equal(spanEventAggregator.limit, 2000, 'should use span_event_harvest_config.harvest_limit')
    t.equal(spanEventAggregator._items.limit, 2000, `should set queue limit`)
    t.end()
  })

  t.test(`should use 'span_event_harvest_config.harvest_limit' from server`, (t) => {
    const fakeConfig = {
      span_event_harvest_config: {
        harvest_limit: 2000
      },
      getAggregatorConfig: sinon.stub().returns(null),
      span_events: {
        max_samples_stored: 3000
      }
    }
    spanEventAggregator.reconfigure(fakeConfig)
    t.equal(spanEventAggregator.limit, 2000, 'should use span_event_harvest_config.harvest_limit')
    t.equal(spanEventAggregator._items.limit, 2000, `should set queue limit`)
    t.end()
  })

  t.test('should use max_samples_stored as-is when no span harvest config', (t) => {
    const expectedLimit = 5000
    const fakeConfig = {
      getAggregatorConfig: sinon.stub().returns(null),
      span_events: {
        max_samples_stored: expectedLimit
      }
    }

    spanEventAggregator.reconfigure(fakeConfig)

    t.equal(spanEventAggregator.limit, expectedLimit)
    t.equal(spanEventAggregator._items.limit, expectedLimit)
    t.end()
  })

  t.test('should use fall-back maximum when no span harvest config sent', (t) => {
    const maxSamples = 20000
    const fakeConfig = {
      getAggregatorConfig: sinon.stub().returns(null),
      span_events: {
        max_samples_stored: maxSamples
      }
    }

    t.ok(maxSamples > MAX_LIMIT, 'failed test setup expectations')

    spanEventAggregator.reconfigure(fakeConfig)
    t.equal(spanEventAggregator.limit, MAX_LIMIT, `should set limit to ${MAX_LIMIT}`)
    t.end()
  })

  t.test('should report SpanEvent/Limit supportability metric', (t) => {
    const recordValueStub = sinon.stub()
    spanEventAggregator._metrics.getOrCreateMetric = sinon
      .stub()
      .returns({ recordValue: recordValueStub })
    const harvestLimit = 2000
    const fakeConfig = {
      getAggregatorConfig: sinon.stub().returns(null),
      span_event_harvest_config: {
        harvest_limit: harvestLimit
      }
    }

    spanEventAggregator.reconfigure(fakeConfig)

    t.equal(
      spanEventAggregator._metrics.getOrCreateMetric.args[0][0],
      'Supportability/SpanEvent/Limit',
      'should name event appropriately'
    )
    t.equal(recordValueStub.args[0][0], harvestLimit, `should set limit to ${harvestLimit}`)
    t.end()
  })
})
