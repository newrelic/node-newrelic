/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')

const helper = require('../../lib/agent_helper')
const SpanEventAggregator = require('../../../lib/spans/span-event-aggregator')
const Metrics = require('../../../lib/metrics')
const SpanLink = require('#agentlib/spans/span-link.js')
const { PARTIAL_TYPES } = require('#agentlib/transaction/index.js')

const RUN_ID = 1337
const DEFAULT_LIMIT = 2000
const MAX_LIMIT = 10000
const DEFAULT_PERIOD = 60000

test('SpanAggregator', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.spanEventAggregator = new SpanEventAggregator(
      {
        runId: RUN_ID,
        limit: DEFAULT_LIMIT,
        periodMs: DEFAULT_PERIOD
      },
      {
        collector: {},
        metrics: new Metrics(5, {}, {}),
        harvester: { add() {} }
      }
    )
    ctx.nr.agent = helper.loadMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should set the correct default method', (t) => {
    const { spanEventAggregator } = t.nr
    const method = spanEventAggregator.method
    assert.equal(method, 'span_event_data')
  })

  await t.test('should add a span event from the given segment', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()

        assert.equal(spanEventAggregator.length, 0)

        spanEventAggregator.addSegment({ segment, transaction: tx, parentId: 'p' })
        assert.equal(spanEventAggregator.length, 1)

        const event = spanEventAggregator.getEvents()[0]

        assert.ok(event.intrinsics)
        assert.equal(event.intrinsics.name, segment.name)
        assert.equal(event.intrinsics.parentId, 'p')
        const metrics = spanEventAggregator._metrics.unscoped
        const metricKeys = Object.keys(metrics)
        // verifies it also does not create the `Supportability/DistributedTrace/PartialGranularity/*`` metrics
        assert.equal(metricKeys.length, 2)
        assert.equal(metrics['Supportability/SpanEvent/TotalEventsSeen'].callCount, 1)
        assert.equal(metrics['Supportability/SpanEvent/TotalEventsSent'].callCount, 1)

        end()
      }, 10)
    })
  })

  await t.test('should default the parent id', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()
        assert.equal(spanEventAggregator.length, 0)

        spanEventAggregator.addSegment({ segment, transaction: tx })
        assert.equal(spanEventAggregator.length, 1)

        const event = spanEventAggregator.getEvents()[0]

        assert.ok(event.intrinsics)
        assert.equal(event.intrinsics.name, segment.name)
        assert.equal(event.intrinsics.parentId, null)

        assert.ok(!event.intrinsics.grandparentId)

        end()
      }, 10)
    })
  })

  await t.test('should indicate if the segment is accepted', (t, end) => {
    const { agent } = t.nr
    const METRIC_NAMES = {
      SEEN: '/SEEN',
      SENT: '/SENT',
      DROPPED: '/DROPPED'
    }

    const metrics = new Metrics(5, {}, {})

    const spanEventAggregator = new SpanEventAggregator(
      {
        runId: RUN_ID,
        limit: 1,
        metricNames: METRIC_NAMES
      },
      {
        collector: {},
        metrics,
        harvester: { add() {} }
      }
    )

    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()

        assert.equal(spanEventAggregator.length, 0)
        assert.equal(spanEventAggregator.seen, 0)

        // First segment is added regardless of priority.
        spanEventAggregator.addSegment({ segment, transaction: tx })
        assert.equal(spanEventAggregator.length, 1)
        assert.equal(spanEventAggregator.seen, 1)

        // Higher priority should be added.
        tx.priority = 100
        spanEventAggregator.addSegment({ segment, transaction: tx })
        assert.equal(spanEventAggregator.length, 1)
        assert.equal(spanEventAggregator.seen, 2)
        const event1 = spanEventAggregator.getEvents()[0]

        // Lower priority should not be added.
        tx.priority = 1
        spanEventAggregator.addSegment({ segment, transaction: tx })
        assert.equal(spanEventAggregator.length, 1)
        assert.equal(spanEventAggregator.seen, 3)
        const event2 = spanEventAggregator.getEvents()[0]

        const metric = metrics.getMetric(METRIC_NAMES.SEEN)

        assert.equal(metric.callCount, 3)

        // Shouldn't change the event in the aggregator.
        assert.equal(event1, event2)

        end()
      }, 10)
    })
  })

  await t.test('_toPayloadSync() should return json format of data', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 1
      tx.sampled = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()

        spanEventAggregator.addSegment({ segment, transaction: tx })

        const payload = spanEventAggregator._toPayloadSync()

        const [runId, metrics, events] = payload

        assert.equal(runId, RUN_ID)

        assert.ok(metrics.reservoir_size)
        assert.ok(metrics.events_seen)
        assert.equal(metrics.reservoir_size, DEFAULT_LIMIT)
        assert.equal(metrics.events_seen, 1)

        assert.ok(events[0])
        assert.ok(events[0].intrinsics)
        assert.equal(events[0].intrinsics.type, 'Span')

        end()
      }, 10)
    })
  })

  await t.test('serialized data should be in correct order', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    const timestamp = 1765285200000 // 2025-12-09T09:00:00.000-04:00
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 1
      tx.sampled = true

      setTimeout(() => {
        const rootSegment = agent.tracer.getSegment()

        const child1Segment = agent.tracer.createSegment({
          id: 'child1',
          name: 'child1-segment',
          parent: rootSegment,
          transaction: tx
        })
        child1Segment.spanLinks.push(new SpanLink({
          link: {
            attributes: {},
            context: { spanId: 'parent1', traceId: 'trace1' }
          },
          spanContext: {
            spanId: 'span1',
            traceId: 'trace1'
          },
          timestamp
        }))

        const child2Segment = agent.tracer.createSegment({
          id: 'child2',
          name: 'child2-segment',
          parent: rootSegment,
          transaction: tx
        })

        spanEventAggregator.addSegment({ segment: rootSegment, transaction: tx })
        spanEventAggregator.addSegment({ segment: child1Segment, transaction: tx })
        spanEventAggregator.addSegment({ segment: child2Segment, transaction: tx })

        const payload = spanEventAggregator._toPayloadSync()

        const [, metrics, events] = payload
        assert.equal(metrics.events_seen, 3, 'span links do not count')

        const linkIdx = events.findIndex((e) => e.intrinsics.type === 'SpanLink')
        assert.equal(linkIdx > 0, true, 'must be subsequent to a Span event')

        const link = events[linkIdx]
        assert.equal(link.intrinsics.id, 'span1')
        assert.equal(link.intrinsics.timestamp, timestamp)
        assert.equal(link.intrinsics['trace.id'], 'trace1')
        assert.equal(link.intrinsics.linkedSpanId, 'parent1')
        assert.equal(link.intrinsics.linkedTraceId, 'trace1')

        const span = events[linkIdx - 1]
        assert.equal(span.intrinsics.type, 'Span')
        assert.equal(span.intrinsics.guid, 'child1')
        assert.equal(span.intrinsics.name, 'child1-segment')

        end()
      }, 10)
    })
  })

  await t.test('span link', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    const timestamp = 1765285200000 // 2025-12-09T09:00:00.000-04:00
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true
      tx.partialType = 'reduced'
      tx.createPartialTrace()

      const rootSegment = agent.tracer.getSegment()

      const child1Segment = agent.tracer.createSegment({
        id: 'child1',
        name: 'child1-segment',
        parent: rootSegment,
        transaction: tx
      })
      child1Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: {},
          context: { spanId: 'parent1', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span1',
          traceId: 'trace1'
        },
        timestamp
      }))

      spanEventAggregator.addSegment({ segment: rootSegment, transaction: tx, parent: '1', isEntry: true })
      spanEventAggregator.addSegment({ segment: child1Segment, transaction: tx, parentId: rootSegment.id, isEntry: false })
      tx.end()
      end()
    })
  })

  await t.test('should use default value for periodMs', (t) => {
    const { spanEventAggregator } = t.nr
    const fakeConfig = {
      getAggregatorConfig: sinon.stub().returns(null),
      span_events: {
        max_samples_stored: DEFAULT_LIMIT
      }
    }
    spanEventAggregator.reconfigure(fakeConfig)
    assert.equal(
      spanEventAggregator.periodMs,
      DEFAULT_PERIOD,
      `should default periodMs to ${DEFAULT_PERIOD}`
    )
  })

  await t.test('should use default value for limit when user cleared', (t) => {
    const { spanEventAggregator } = t.nr
    const fakeConfig = {
      getAggregatorConfig: sinon.stub().returns(null),
      span_events: {
        enabled: true,
        max_samples_stored: ''
      }
    }

    spanEventAggregator.reconfigure(fakeConfig)

    assert.equal(
      spanEventAggregator.limit,
      DEFAULT_LIMIT,
      `should default limit to ${DEFAULT_LIMIT}`
    )
    assert.equal(
      spanEventAggregator._items.limit,
      DEFAULT_LIMIT,
      `should set queue limit to ${DEFAULT_LIMIT}`
    )
  })

  await t.test('should use `span_event_harvest_config.report_period_ms` from server', (t) => {
    const { spanEventAggregator } = t.nr
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

    assert.equal(
      spanEventAggregator.periodMs,
      4000,
      'should use span_event_harvest_config.report_period_ms'
    )
  })

  await t.test("should use 'span_event_harvest_config.harvest_limit' from server", (t) => {
    const { spanEventAggregator } = t.nr
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
    assert.equal(
      spanEventAggregator.limit,
      2000,
      'should use span_event_harvest_config.harvest_limit'
    )
    assert.equal(spanEventAggregator._items.limit, 2000, 'should set queue limit')
  })

  await t.test("should use 'span_event_harvest_config.harvest_limit' from server", (t) => {
    const { spanEventAggregator } = t.nr
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
    assert.equal(
      spanEventAggregator.limit,
      2000,
      'should use span_event_harvest_config.harvest_limit'
    )
    assert.equal(spanEventAggregator._items.limit, 2000, 'should set queue limit')
  })

  await t.test('should use max_samples_stored as-is when no span harvest config', (t) => {
    const { spanEventAggregator } = t.nr
    const expectedLimit = 5000
    const fakeConfig = {
      getAggregatorConfig: sinon.stub().returns(null),
      span_events: {
        max_samples_stored: expectedLimit
      }
    }

    spanEventAggregator.reconfigure(fakeConfig)

    assert.equal(spanEventAggregator.limit, expectedLimit)
    assert.equal(spanEventAggregator._items.limit, expectedLimit)
  })

  await t.test('should use fall-back maximum when no span harvest config sent', (t) => {
    const { spanEventAggregator } = t.nr
    const maxSamples = 20000
    const fakeConfig = {
      getAggregatorConfig: sinon.stub().returns(null),
      span_events: {
        max_samples_stored: maxSamples
      }
    }

    assert.ok(maxSamples > MAX_LIMIT, 'failed test setup expectations')

    spanEventAggregator.reconfigure(fakeConfig)
    assert.equal(spanEventAggregator.limit, MAX_LIMIT, `should set limit to ${MAX_LIMIT}`)
  })

  await t.test('should report SpanEvent/Limit supportability metric', (t) => {
    const { spanEventAggregator } = t.nr
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

    assert.equal(
      spanEventAggregator._metrics.getOrCreateMetric.args[0][0],
      'Supportability/SpanEvent/Limit',
      'should name event appropriately'
    )
    assert.equal(recordValueStub.args[0][0], harvestLimit, `should set limit to ${harvestLimit}`)
  })

  await t.test('should not add span to aggregator but instead to trace when transaction.partialType is set and span is retained', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true
      tx.partialType = PARTIAL_TYPES.REDUCED
      tx.createPartialTrace()
      const segment = agent.tracer.getSegment()

      assert.equal(spanEventAggregator.length, 0)
      assert.equal(tx.partialTrace.spans.length, 0)

      spanEventAggregator.addSegment({ segment, transaction: tx, parentId: 'p', isEntry: true })
      assert.equal(spanEventAggregator.length, 0)
      assert.equal(tx.partialTrace.spans.length, 1)
      const unscopedMetrics = tx.metrics.unscoped
      assert.equal(unscopedMetrics['Supportability/Nodejs/PartialGranularity/reduced'].callCount, 1)
      assert.equal(unscopedMetrics['Supportability/DistributedTrace/PartialGranularity/reduced/Span/Instrumented'].callCount, 1)
      assert.equal(unscopedMetrics['Supportability/DistributedTrace/PartialGranularity/reduced/Span/Kept'].callCount, 1)

      end()
    })
  })

  await t.test('should not add span to aggregator nor to trace when transaction.partialType is set and span not retained', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true
      tx.partialType = PARTIAL_TYPES.REDUCED
      tx.createPartialTrace()
      const segment = agent.tracer.getSegment()

      assert.equal(spanEventAggregator.length, 0)
      assert.equal(tx.partialTrace.spans.length, 0)

      spanEventAggregator.addSegment({ segment, transaction: tx, parentId: 'p' })
      assert.equal(spanEventAggregator.length, 0)
      assert.equal(tx.partialTrace.spans.length, 0)
      const unscopedMetrics = tx.metrics.unscoped
      assert.equal(unscopedMetrics['Supportability/Nodejs/PartialGranularity/reduced'].callCount, 1)
      assert.equal(unscopedMetrics['Supportability/DistributedTrace/PartialGranularity/reduced/Span/Instrumented'].callCount, 1)
      assert.equal(unscopedMetrics['Supportability/DistributedTrace/PartialGranularity/reduced/Span/Kept'], undefined)

      end()
    })
  })
})
