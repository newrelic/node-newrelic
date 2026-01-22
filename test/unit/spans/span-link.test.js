/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const SpanLink = require('#agentlib/spans/span-link.js')
const { match } = require('#test/assert')
const sinon = require('sinon')
const helper = require('../../lib/agent_helper')
const SpanEventAggregator = require('../../../lib/spans/span-event-aggregator')
const Metrics = require('../../../lib/metrics')
const { PARTIAL_TYPES } = require('#agentlib/transaction/index.js')
const SpanEvent = require('#agentlib/spans/span-event.js')

const RUN_ID = 1337
const DEFAULT_LIMIT = 2000
const DEFAULT_PERIOD = 60000

test('requires link data', (t) => {
  t.plan(2)

  const logger = {
    error(msg) {
      t.assert.equal(msg, 'cannot create span link without required link data')
    }
  }

  const link = new SpanLink({}, { logger })
  t.assert.ok(link)
})

test('requires span context', (t) => {
  t.plan(2)

  const logger = {
    error(msg) {
      t.assert.equal(msg, 'cannot create span link without required span context')
    }
  }

  const otelLink = {}
  const link = new SpanLink({ link: otelLink }, { logger })
  t.assert.ok(link)
})

test('builds correct instance', (t) => {
  const otelLink = {
    context: {
      spanId: 'upstream-span-id',
      traceId: 'upstream-trace-id'
    },
    attributes: {
      testAttr1: 'ok1',
      testAttr2: 'ok2',
      testAttr3: null
    }
  }
  const spanContext = {
    spanId: 'local-span-id',
    traceId: 'local-trace-id'
  }
  const link = new SpanLink({ link: otelLink, spanContext, timestamp: 123 })

  const expectedIntrinsics = {
    type: 'SpanLink',
    id: spanContext.spanId,
    timestamp: 123,
    'trace.id': spanContext.traceId,
    linkedSpanId: otelLink.context.spanId,
    linkedTraceId: otelLink.context.traceId
  }

  assert.ok(link)
  assert.equal(link.toString(), '[object SpanLink]')
  match(link.getIntrinsicAttributes(), expectedIntrinsics)
  match(link.toJSON(), [
    expectedIntrinsics,
    { testAttr1: 'ok1', testAttr2: 'ok2' },
    {}
  ])
})

test('partial tracing with span links', async (t) => {
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

  await t.test('span link moved to nearest parent when using reduced tracing', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    const timestamp = 1765285200000 // 2025-12-09T09:00:00.000-04:00
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true
      tx.partialType = PARTIAL_TYPES.REDUCED
      tx.createPartialTrace()

      const rootSegment = agent.tracer.getSegment()

      const child1Segment = agent.tracer.createSegment({
        id: 'child1',
        name: 'child1-segment',
        parent: rootSegment,
        transaction: tx
      })

      const child2Segment = agent.tracer.createSegment({
        id: 'child2',
        name: 'child2-segment',
        parent: child1Segment,
        transaction: tx
      })

      child1Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'test1' },
          context: { spanId: 'parent1', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span1',
          traceId: 'trace1'
        },
        timestamp
      }))

      child2Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'test2' },
          context: { spanId: 'parent2', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span2',
          traceId: 'trace2'
        },
        timestamp
      }))

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child2Segment.spanLinks[0].intrinsics.id, 'span2')

      spanEventAggregator.addSegment({ segment: rootSegment, transaction: tx, parent: '1', isEntry: true })
      // root span has no span links
      assert.equal(rootSegment.spanLinks.length, 0)

      spanEventAggregator.addSegment({ segment: child1Segment, transaction: tx, parentId: rootSegment.id, isEntry: false })
      spanEventAggregator.addSegment({ segment: child2Segment, transaction: tx, parentId: child1Segment.id, isEntry: false })

      // two children spans with span links dropped
      assert.equal(tx.partialTrace.droppedSpans.size, 2)

      // only one span was kept
      assert.equal(tx.partialTrace.spans.length, 1)

      const keptSpan = tx.partialTrace.spans[0]

      // kept span has two span links moved to it
      assert.equal(keptSpan.spanLinks.length, 2)

      // nearest parent span has both span links with their intrinsics id matching the span id they are linked to now
      assert.equal(keptSpan.spanLinks[0].intrinsics.id, keptSpan.id)
      assert.equal(keptSpan.spanLinks[0].userAttributes.attributes.test.value, 'test1')
      assert.equal(keptSpan.spanLinks[1].intrinsics.id, keptSpan.id)
      assert.equal(keptSpan.spanLinks[1].userAttributes.attributes.test.value, 'test2')

      end()
    })
  })

  await t.test('span link moved to nearest parent when using reduced tracing and combined with parent span links', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    const timestamp = 1765285200000 // 2025-12-09T09:00:00.000-04:00
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true
      tx.partialType = PARTIAL_TYPES.REDUCED
      tx.createPartialTrace()

      const rootSegment = agent.tracer.getSegment()

      rootSegment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'rootTest' },
          context: { spanId: rootSegment.id, traceId: 'trace1' }
        },
        spanContext: {
          spanId: rootSegment.id,
          traceId: 'trace1'
        },
        timestamp
      }))

      const child1Segment = agent.tracer.createSegment({
        id: 'child1',
        name: 'child1-segment',
        parent: rootSegment,
        transaction: tx
      })

      const child2Segment = agent.tracer.createSegment({
        id: 'child2',
        name: 'child2-segment',
        parent: child1Segment,
        transaction: tx
      })

      child1Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'test1' },
          context: { spanId: 'parent1', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span1',
          traceId: 'trace1'
        },
        timestamp
      }))

      child2Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'test2' },
          context: { spanId: 'parent2', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span2',
          traceId: 'trace2'
        },
        timestamp
      }))

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child2Segment.spanLinks[0].intrinsics.id, 'span2')

      spanEventAggregator.addSegment({ segment: rootSegment, transaction: tx, parent: '1', isEntry: true })
      // root span has 1 span link of it's own
      assert.equal(rootSegment.spanLinks.length, 1)

      spanEventAggregator.addSegment({ segment: child1Segment, transaction: tx, parentId: rootSegment.id, isEntry: false })
      spanEventAggregator.addSegment({ segment: child2Segment, transaction: tx, parentId: child1Segment.id, isEntry: false })

      // two children spans with span links dropped
      assert.equal(tx.partialTrace.droppedSpans.size, 2)

      // only one span was kept
      assert.equal(tx.partialTrace.spans.length, 1)

      const keptSpan = tx.partialTrace.spans[0]

      // kept span has two span links moved to it and combined with kept span's own span links
      assert.equal(keptSpan.spanLinks.length, 3)

      // kept span still retains its own span link
      assert.equal(keptSpan.spanLinks[0].intrinsics.id, keptSpan.id)
      assert.equal(keptSpan.spanLinks[0].userAttributes.attributes.test.value, 'rootTest')

      // nearest parent span has both span links with their intrinsics id matching the span id they are linked to now
      assert.equal(keptSpan.spanLinks[1].intrinsics.id, keptSpan.id)
      assert.equal(keptSpan.spanLinks[1].userAttributes.attributes.test.value, 'test1')
      assert.equal(keptSpan.spanLinks[2].intrinsics.id, keptSpan.id)
      assert.equal(keptSpan.spanLinks[2].userAttributes.attributes.test.value, 'test2')

      end()
    })
  })

  await t.test('do not move span link from dropped span if the nearest parent span\'s span link is full - any partial tracing mode', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    const timestamp = 1765285200000 // 2025-12-09T09:00:00.000-04:00
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true
      tx.partialType = PARTIAL_TYPES.REDUCED
      tx.createPartialTrace()

      const rootSegment = agent.tracer.getSegment()

      for (let i = 0; i < 99; i += 1) {
        rootSegment.addSpanLink({ fake: 'link' })
      }

      const child1Segment = agent.tracer.createSegment({
        id: 'child1',
        name: 'child1-segment',
        parent: rootSegment,
        transaction: tx
      })

      child1Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'test1' },
          context: { spanId: 'parent1', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span1',
          traceId: 'trace1'
        },
        timestamp
      }))

      child1Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'test2' },
          context: { spanId: 'parent1', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span2',
          traceId: 'trace1'
        },
        timestamp
      }))

      spanEventAggregator.addSegment({ segment: rootSegment, transaction: tx, parent: '1', isEntry: true })
      // root span has 99 span links of it's own
      assert.equal(rootSegment.spanLinks.length, 99)

      spanEventAggregator.addSegment({ segment: child1Segment, transaction: tx, parentId: rootSegment.id, isEntry: false })

      // one child span dropped
      assert.equal(tx.partialTrace.droppedSpans.size, 1)

      // only one span was kept
      assert.equal(tx.partialTrace.spans.length, 1)

      const keptSpan = tx.partialTrace.spans[0]

      // kept span has one span links moved to it since limit was met (100 span links per span)
      assert.equal(keptSpan.spanLinks.length, 100)

      // since there was only 1 span link spot remaining on the parent span, only the 1st span
      // link from the dropped span was moved over
      assert.equal(keptSpan.spanLinks[99].intrinsics.id, keptSpan.id)
      assert.equal(keptSpan.spanLinks[99].userAttributes.attributes.test.value, 'test1')

      end()
    })
  })

  await t.test('span link non intrinsics attrs removed when using essential tracing', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    const timestamp = 1765285200000 // 2025-12-09T09:00:00.000-04:00
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true
      tx.partialType = PARTIAL_TYPES.ESSENTIAL
      tx.createPartialTrace()

      const rootSegment = agent.tracer.getSegment()

      // this span will be kept since it's an exit span (message broker)
      const child1Segment = agent.tracer.createSegment({
        id: 'child1',
        name: 'MessageBroker/api.example.com/users',
        parent: rootSegment,
        transaction: tx
      })

      child1Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'test1' },
          context: { spanId: 'parent1', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span1',
          traceId: 'trace1'
        },
        timestamp
      }))

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')

      spanEventAggregator.addSegment({ segment: rootSegment, transaction: tx, parent: '1', isEntry: true })
      // root span has no span links
      assert.equal(rootSegment.spanLinks.length, 0)

      // simulate that the segment has entity relationship attrs to keep the span
      const hasEntityStub = sinon.stub(SpanEvent.prototype, 'hasEntityRelationshipAttrs').get(() => true)

      spanEventAggregator.addSegment({ segment: child1Segment, transaction: tx, parentId: rootSegment.id, isEntry: false })
      hasEntityStub.restore()

      // no dropped spans
      assert.equal(tx.partialTrace.droppedSpans.size, 0)

      // both spans kept
      assert.equal(tx.partialTrace.spans.length, 2)

      const keptSpanWithLinks = tx.partialTrace.spans[1]

      // kept span has one span link - it's own
      assert.equal(keptSpanWithLinks.spanLinks.length, 1)

      // kept span retains the same span link id as the span id since it wasn't dropped
      assert.equal(keptSpanWithLinks.spanLinks[0].intrinsics.id, 'span1')

      // user and agent attributes are not kept on essential partial traces
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[0].userAttributes.attributes).length, 0)
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[0].agentAttributes.attributes).length, 0)

      end()
    })
  })

  await t.test('span link moved to nearest parent and non intrinsics attrs removed when using essential tracing', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    const timestamp = 1765285200000 // 2025-12-09T09:00:00.000-04:00
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true
      tx.partialType = PARTIAL_TYPES.ESSENTIAL
      tx.createPartialTrace()

      const rootSegment = agent.tracer.getSegment()

      // this span will be kept since it's an exit span (message broker)
      const child1Segment = agent.tracer.createSegment({
        id: 'child1',
        name: 'MessageBroker/api.example.com/users',
        parent: rootSegment,
        transaction: tx
      })

      // this span will be dropped since it's not an exit span
      const child2Segment = agent.tracer.createSegment({
        id: 'child2',
        name: 'child2-segment',
        parent: child1Segment,
        transaction: tx
      })

      child1Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'test1' },
          context: { spanId: 'parent1', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span1',
          traceId: 'trace1'
        },
        timestamp
      }))

      child2Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'test2' },
          context: { spanId: 'parent2', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span2',
          traceId: 'trace2'
        },
        timestamp
      }))

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child2Segment.spanLinks[0].intrinsics.id, 'span2')

      spanEventAggregator.addSegment({ segment: rootSegment, transaction: tx, parent: '1', isEntry: true })
      // root span has no span links
      assert.equal(rootSegment.spanLinks.length, 0)

      // simulate that the segment has entity relationship attrs to keep the span
      const hasEntityStub = sinon.stub(SpanEvent.prototype, 'hasEntityRelationshipAttrs').get(() => true)

      spanEventAggregator.addSegment({ segment: child1Segment, transaction: tx, parentId: rootSegment.id, isEntry: false })
      hasEntityStub.restore()
      spanEventAggregator.addSegment({ segment: child2Segment, transaction: tx, parentId: child1Segment.id, isEntry: false })

      // one span with span links dropped
      assert.equal(tx.partialTrace.droppedSpans.size, 1)

      // two spans were kept
      assert.equal(tx.partialTrace.spans.length, 2)

      const keptSpanWithLinks = tx.partialTrace.spans[1]

      // kept span has two span links - it's own and the one moved to it
      assert.equal(keptSpanWithLinks.spanLinks.length, 2)

      // kept span retains the same span link id as the span id
      assert.equal(keptSpanWithLinks.spanLinks[0].intrinsics.id, 'span1')
      // nearest parent span has dropped span links with their intrinsics id matching the span id they are linked to now
      assert.equal(keptSpanWithLinks.spanLinks[1].intrinsics.id, keptSpanWithLinks.id)

      // user and agent attributes are not kept on essential partial traces
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[0].userAttributes.attributes).length, 0)
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[1].userAttributes.attributes).length, 0)
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[0].agentAttributes.attributes).length, 0)
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[1].agentAttributes.attributes).length, 0)

      end()
    })
  })

  await t.test('span links compressed to one kept span if there are multiple spans for the same entity when using compact tracing', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    const timestamp = 1765285200000 // 2025-12-09T09:00:00.000-04:00
    helper.runInTransaction(agent, (tx) => {
      tx.priority = 42
      tx.sampled = true
      tx.partialType = PARTIAL_TYPES.COMPACT
      // tx.partialTrace.type = Transaction.PARTIAL_TYPES.COMPACT
      tx.createPartialTrace()

      const removeNonIntrAttrSpy = sinon.spy(tx.partialTrace, 'removeNonIntrinsicsAttrs')
      const reparentSpanLinkSpy = sinon.spy(tx.partialTrace, 'reparentSpanLinks')

      const rootSegment = agent.tracer.getSegment()

      // first exit span to a message broker
      const child1Segment = agent.tracer.createSegment({
        id: 'child1',
        name: 'MessageBroker/api.example.com/users',
        parent: rootSegment,
        transaction: tx
      })

      // entry span to another service
      const child2Segment = agent.tracer.createSegment({
        id: 'child2',
        name: 'child2-segment',
        parent: child1Segment,
        transaction: tx
      })

      // second exit span to the same message broker
      const child3Segment = agent.tracer.createSegment({
        id: 'child3',
        name: 'MessageBroker/api.example.com/users',
        parent: rootSegment,
        transaction: tx
      })

      // entry span to another service
      const child4Segment = agent.tracer.createSegment({
        id: 'child4',
        name: 'child4-segment',
        parent: child3Segment,
        transaction: tx
      })

      child1Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'test1' },
          context: { spanId: 'parent1', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span1',
          traceId: 'trace1'
        },
        timestamp
      }))

      child3Segment.spanLinks.push(new SpanLink({
        link: {
          attributes: { test: 'test2' },
          context: { spanId: 'parent1', traceId: 'trace1' }
        },
        spanContext: {
          spanId: 'span1',
          traceId: 'trace1'
        },
        timestamp
      }))

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child3Segment.spanLinks[0].intrinsics.id, 'span1')

      spanEventAggregator.addSegment({ segment: rootSegment, transaction: tx, parent: '1', isEntry: true })
      tx.baseSegment = rootSegment

      // simulate that the segment has entity relationship attrs to keep the span
      const hasEntityStub = sinon.stub(SpanEvent.prototype, 'hasEntityRelationshipAttrs').get(() => true)

      spanEventAggregator.addSegment({ segment: child1Segment, transaction: tx, parentId: rootSegment.id, isEntry: false })
      spanEventAggregator.addSegment({ segment: child2Segment, transaction: tx, parentId: child1Segment.id, isEntry: true })
      spanEventAggregator.addSegment({ segment: child3Segment, transaction: tx, parentId: rootSegment.id, isEntry: false })
      spanEventAggregator.addSegment({ segment: child4Segment, transaction: tx, parentId: child3Segment.id, isEntry: true })
      hasEntityStub.restore()

      tx.partialTrace.finalize()

      assert.equal(removeNonIntrAttrSpy.callCount, 1)
      assert.equal(reparentSpanLinkSpy.callCount, 1)

      const events = tx.agent.spanEventAggregator.getEvents()
      const compressedExitSpan = events.find((span) => span.intrinsics.name === 'MessageBroker/api.example.com/users')

      // only one compressed exit span for the same entity with two span links now
      assert.equal(compressedExitSpan.spanLinks.length, 2)

      assert.equal(compressedExitSpan.spanLinks[1].intrinsics.id, compressedExitSpan.id)

      // non instrincs attrs are removed on compact partial traces
      assert.equal(Object.keys(compressedExitSpan.spanLinks[1].userAttributes.attributes).length, 0)
      assert.equal(Object.keys(compressedExitSpan.spanLinks[1].agentAttributes.attributes).length, 0)

      end()
    })
  })
})
