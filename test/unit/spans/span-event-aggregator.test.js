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
const logger = require('../../../lib/logger')

const RUN_ID = 1337
const LIMIT = 1000

tap.test('SpanAggregator', (t) => {
  t.autoend()

  let spanEventAggregator = null
  let agent = null

  t.beforeEach(() => {
    spanEventAggregator = new SpanEventAggregator(
      {
        runId: RUN_ID,
        limit: LIMIT
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

        var payload = spanEventAggregator._toPayloadSync()

        const [runId, metrics, events] = payload

        t.equal(runId, RUN_ID)

        t.ok(metrics.reservoir_size)
        t.ok(metrics.events_seen)
        t.equal(metrics.reservoir_size, LIMIT)
        t.equal(metrics.events_seen, 1)

        t.ok(events[0])
        t.ok(events[0].intrinsics)
        t.equal(events[0].intrinsics.type, 'Span')

        t.end()
      }, 10)
    })
  })

  t.test('should log span trace data when traceEnabled', (t) => {
    let ct = 0
    const fakeLogger = {
      traceEnabled: () => true,
      trace: () => ++ct,
      debug: () => {}
    }

    sinon.stub(logger, 'child').callsFake(() => fakeLogger)

    const spanEventAgg = new SpanEventAggregator(
      {
        runId: RUN_ID,
        limit: LIMIT
      },
      {},
      new Metrics(5, {}, {})
    )

    spanEventAgg.send()
    logger.child.restore()

    t.equal(ct, 1)

    t.end()
  })

  t.test('should not log span trace data when !traceEnabled', (t) => {
    let ct = 0
    const fakeLogger = {
      traceEnabled: () => false,
      trace: () => ++ct,
      debug: () => {}
    }

    sinon.stub(logger, 'child').callsFake(() => fakeLogger)

    const spanEventAgg = new SpanEventAggregator(
      {
        runId: RUN_ID,
        limit: LIMIT
      },
      {},
      new Metrics(5, {}, {})
    )

    spanEventAgg.send()
    logger.child.restore()

    t.equal(ct, 0)
    t.end()
  })
})
