/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const SpanLink = require('#agentlib/spans/span-link.js')
const { match } = require('#test/assert')
const helper = require('../../lib/agent_helper')
const SpanAggregator = require('../../../lib/spans/span-aggregator')
const Metrics = require('../../../lib/metrics')
const { PARTIAL_TYPES } = require('#agentlib/transaction/index.js')
const {
  setupPartialTrace,
  stubEntityRelationship,
  assertSpanLinkAttributes,
  addSegment,
  createSegment,
  createSpanLink,
  setupPartialTraceForCompactCompression,
  addSegmentsForCompactCompression
} = require('./helpers.js')

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
    ctx.nr.spanAggregator = new SpanAggregator(
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
    const { agent, spanAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const { rootSegment, child1Segment, child2Segment } = setupPartialTrace({ agent, partialType: PARTIAL_TYPES.REDUCED, tx })

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child2Segment.spanLinks[0].intrinsics.id, 'span2')

      addSegment({ spanAggregator, tx, segment: rootSegment, isEntry: true })
      // root span has no span links
      assert.equal(rootSegment.spanLinks.length, 0)

      addSegment({ spanAggregator, tx, segment: child1Segment, parentId: rootSegment.id })
      addSegment({ spanAggregator, tx, segment: child2Segment, parentId: child1Segment.id })

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
    const { agent, spanAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const { rootSegment, child1Segment, child2Segment } = setupPartialTrace({ agent, partialType: PARTIAL_TYPES.REDUCED, tx, addRootSpanLink: true })

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child2Segment.spanLinks[0].intrinsics.id, 'span2')

      addSegment({ spanAggregator, tx, segment: rootSegment, isEntry: true })
      // root span has 1 span link of it's own
      assert.equal(rootSegment.spanLinks.length, 1)

      addSegment({ spanAggregator, tx, segment: child1Segment, parentId: rootSegment.id })
      addSegment({ spanAggregator, tx, segment: child2Segment, parentId: child1Segment.id })

      // two children spans with span links dropped
      assert.equal(tx.partialTrace.droppedSpans.size, 2)

      // only one span was kept
      assert.equal(tx.partialTrace.spans.length, 1)

      const keptSpan = tx.partialTrace.spans[0]
      // kept span has two span links moved to it and combined with parent span's own span links
      assert.equal(keptSpan.spanLinks.length, 3)

      // parent/root span still retains its own span link
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
    const { agent, spanAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const { rootSegment, child1Segment } = setupPartialTrace({ agent, partialType: PARTIAL_TYPES.REDUCED, tx, add99SpanLinks: true, numOfChildSegments: 1 })
      // add another span link to child
      createSpanLink({ segment: child1Segment, spanId: 'span2', traceId: 'trace1', linkSpanId: 'parent1', linkTraceId: 'trace1', testAttr: 'test2' })

      addSegment({ spanAggregator, tx, segment: rootSegment, isEntry: true })
      // root span has 99 span links of it's own
      assert.equal(rootSegment.spanLinks.length, 99)

      addSegment({ spanAggregator, tx, segment: child1Segment, parentId: rootSegment.id })
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
      // second span link dropped because of limit
      assert.equal(agent.metrics._metrics.unscoped['Supportability/Nodejs/SpanEvent/Links/Dropped'].callCount, 1)
      assert.equal(keptSpan.spanLinks[99].userAttributes.attributes.test.value, 'test1')
      end()
    })
  })

  await t.test('span link non intrinsics attrs removed when using essential tracing', (t, end) => {
    const { agent, spanAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const { rootSegment, child1Segment } = setupPartialTrace({ agent, partialType: PARTIAL_TYPES.ESSENTIAL, tx, addExitSpan: true, numOfChildSegments: 1 })

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')

      addSegment({ spanAggregator, tx, segment: rootSegment, isEntry: true })
      // root span has no span links
      assert.equal(rootSegment.spanLinks.length, 0)

      // simulate that the segment has entity relationship attrs to keep the span
      const hasEntityStub = stubEntityRelationship(true)
      addSegment({ spanAggregator, tx, segment: child1Segment, parentId: rootSegment.id })
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
      assertSpanLinkAttributes(keptSpanWithLinks.spanLinks)
      end()
    })
  })

  await t.test('span link moved to nearest parent and non intrinsics attrs removed when using essential tracing', (t, end) => {
    const { agent, spanAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const { rootSegment, child1Segment, child2Segment } = setupPartialTrace({ agent, partialType: PARTIAL_TYPES.ESSENTIAL, tx, addExitSpan: true })

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child2Segment.spanLinks[0].intrinsics.id, 'span2')

      addSegment({ spanAggregator, tx, segment: rootSegment, isEntry: true })
      // root span has no span links
      assert.equal(rootSegment.spanLinks.length, 0)

      // simulate that the segment has entity relationship attrs to keep the span
      const hasEntityStub = stubEntityRelationship(true)
      addSegment({ spanAggregator, tx, segment: child1Segment, parentId: rootSegment.id })
      hasEntityStub.restore()

      addSegment({ spanAggregator, tx, segment: child2Segment, parentId: child1Segment.id })

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
      assertSpanLinkAttributes(keptSpanWithLinks.spanLinks)
      end()
    })
  })

  await t.test('span links compressed to one kept span if there are multiple spans for the same entity when using compact tracing', (t, end) => {
    const { agent, spanAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const { rootSegment, child1Segment, child2Segment, child3Segment, child4Segment, reparentSpanLinkSpy } = setupPartialTraceForCompactCompression(agent, tx)

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child3Segment.spanLinks[0].intrinsics.id, 'span1')

      addSegmentsForCompactCompression({ spanAggregator, tx, segments: { rootSegment, child1Segment, child2Segment, child3Segment, child4Segment } })
      tx.partialTrace.finalize()

      assert.equal(reparentSpanLinkSpy.callCount, 1)

      const events = tx.agent.spanAggregator.getEvents()
      const compressedExitSpan = events.find((span) => span.intrinsics.name === 'MessageBroker/api.example.com/users')

      // only one compressed exit span for the same entity with two span links now
      assert.equal(compressedExitSpan.spanLinks.length, 2)
      assert.equal(compressedExitSpan.spanLinks[1].intrinsics.id, compressedExitSpan.id)

      // non instrincs attrs are removed on compact partial traces
      assertSpanLinkAttributes(compressedExitSpan.spanLinks)
      end()
    })
  })

  await t.test('move span links in compact for non exit spans with entity relationship attributes', (t, end) => {
    const { agent, spanAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const { rootSegment, child1Segment } = setupPartialTrace({ agent, partialType: PARTIAL_TYPES.COMPACT, tx, addExitSpan: true, numOfChildSegments: 1 })

      // entry span to another service under root (unique for this test)
      const child2Segment = createSegment(agent, 'child2', 'child2-segment', rootSegment, tx)
      createSpanLink({ segment: child2Segment, spanId: 'span1', traceId: 'trace1', linkSpanId: 'parent1', linkTraceId: 'trace1', testAttr: 'test2' })

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child2Segment.spanLinks[0].intrinsics.id, 'span1')

      addSegment({ spanAggregator, tx, segment: rootSegment, isEntry: true })

      // simulate that the segment has entity relationship attrs to keep the span
      const hasEntityStub = stubEntityRelationship(true)
      addSegment({ spanAggregator, tx, segment: child1Segment, parentId: rootSegment.id })
      addSegment({ spanAggregator, tx, segment: child2Segment, parentId: rootSegment.id })
      hasEntityStub.restore()

      // one span with span links dropped move to nearest parent
      const keptSpanWithLinks = tx.partialTrace.spans[1]
      assert.equal(keptSpanWithLinks.spanLinks.length, 2)

      assert.equal(keptSpanWithLinks.spanLinks[1].intrinsics.id, keptSpanWithLinks.id)

      // non instrincs attrs are removed on compact partial traces
      assertSpanLinkAttributes(keptSpanWithLinks.spanLinks)
      end()
    })
  })

  await t.test('move span links in compact for non exit spans with no entity relationship attributes', (t, end) => {
    const { agent, spanAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const { rootSegment, child1Segment } = setupPartialTrace({ agent, partialType: PARTIAL_TYPES.COMPACT, tx, addExitSpan: true, numOfChildSegments: 1 })

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(rootSegment.spanLinks.length, 0)

      addSegment({ spanAggregator, tx, segment: rootSegment, isEntry: true })

      // simulate that the segment has no entity relationship attrs to drop the span
      const hasEntityStub = stubEntityRelationship(false)
      addSegment({ spanAggregator, tx, segment: child1Segment, parentId: rootSegment.id })
      hasEntityStub.restore()

      // only one kept span
      assert.equal(tx.partialTrace.spans.length, 1)

      // one span with span links dropped move to nearest parent
      const keptSpan = tx.partialTrace.spans[0]
      assert.equal(keptSpan.spanLinks.length, 1)

      assert.equal(keptSpan.spanLinks[0].intrinsics.id, keptSpan.id)

      // non instrincs attrs are removed on compact partial traces
      assertSpanLinkAttributes(keptSpan.spanLinks)
      end()
    })
  })
})
