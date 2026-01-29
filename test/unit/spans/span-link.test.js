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
const TIMESTAMP = 1765285200000 // 2025-12-09T09:00:00.000-04:00

function setupPartialTransaction(tx, partialType) {
  tx.priority = 42
  tx.sampled = true
  tx.partialType = partialType
  tx.createPartialTrace()
}

function createSpanLink(segment, spanId, traceId, linkSpanId, linkTraceId, testAttr) {
  const link = new SpanLink({
    link: {
      attributes: { test: testAttr },
      context: { spanId: linkSpanId, traceId: linkTraceId }
    },
    spanContext: {
      spanId,
      traceId
    },
    timestamp: TIMESTAMP
  })
  segment.spanLinks.push(link)
  return link
}

function addRootSegment(spanEventAggregator, tx, rootSegment) {
  spanEventAggregator.addSegment({ segment: rootSegment, transaction: tx, parent: '1', isEntry: true })
}

function addChildSegment(spanEventAggregator, tx, segment, parentId, isEntry = false) {
  spanEventAggregator.addSegment({ segment, transaction: tx, parentId, isEntry })
}

function stubEntityRelationship(hasEntity) {
  return sinon.stub(SpanEvent.prototype, 'hasEntityRelationshipAttrs').get(() => hasEntity)
}

function createSegment(agent, id, name, parent, tx) {
  return agent.tracer.createSegment({
    id,
    name,
    parent,
    transaction: tx
  })
}

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
    helper.runInTransaction(agent, (tx) => {
      setupPartialTransaction(tx, PARTIAL_TYPES.REDUCED)

      const rootSegment = agent.tracer.getSegment()
      const child1Segment = createSegment(agent, 'child1', 'child1-segment', rootSegment, tx)
      const child2Segment = createSegment(agent, 'child2', 'child2-segment', child1Segment, tx)

      createSpanLink(child1Segment, 'span1', 'trace1', 'parent1', 'trace1', 'test1')
      createSpanLink(child2Segment, 'span2', 'trace2', 'parent2', 'trace1', 'test2')

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child2Segment.spanLinks[0].intrinsics.id, 'span2')

      addRootSegment(spanEventAggregator, tx, rootSegment)
      // root span has no span links
      assert.equal(rootSegment.spanLinks.length, 0)

      addChildSegment(spanEventAggregator, tx, child1Segment, rootSegment.id)
      addChildSegment(spanEventAggregator, tx, child2Segment, child1Segment.id)

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
    helper.runInTransaction(agent, (tx) => {
      setupPartialTransaction(tx, PARTIAL_TYPES.REDUCED)

      const rootSegment = agent.tracer.getSegment()
      const child1Segment = createSegment(agent, 'child1', 'child1-segment', rootSegment, tx)
      const child2Segment = createSegment(agent, 'child2', 'child2-segment', child1Segment, tx)

      createSpanLink(rootSegment, rootSegment.id, 'trace1', rootSegment.id, 'trace1', 'rootTest')
      createSpanLink(child1Segment, 'span1', 'trace1', 'parent1', 'trace1', 'test1')
      createSpanLink(child2Segment, 'span2', 'trace2', 'parent2', 'trace1', 'test2')

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child2Segment.spanLinks[0].intrinsics.id, 'span2')

      addRootSegment(spanEventAggregator, tx, rootSegment)
      // root span has 1 span link of it's own
      assert.equal(rootSegment.spanLinks.length, 1)

      addChildSegment(spanEventAggregator, tx, child1Segment, rootSegment.id)
      addChildSegment(spanEventAggregator, tx, child2Segment, child1Segment.id)

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
    helper.runInTransaction(agent, (tx) => {
      setupPartialTransaction(tx, PARTIAL_TYPES.REDUCED)

      const rootSegment = agent.tracer.getSegment()

      for (let i = 0; i < 99; i += 1) {
        rootSegment.addSpanLink({ fake: 'link' })
      }

      const child1Segment = createSegment(agent, 'child1', 'child1-segment', rootSegment, tx)

      createSpanLink(child1Segment, 'span1', 'trace1', 'parent1', 'trace1', 'test1')
      createSpanLink(child1Segment, 'span2', 'trace1', 'parent1', 'trace1', 'test2')

      addRootSegment(spanEventAggregator, tx, rootSegment)
      // root span has 99 span links of it's own
      assert.equal(rootSegment.spanLinks.length, 99)

      addChildSegment(spanEventAggregator, tx, child1Segment, rootSegment.id)

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
    const { agent, spanEventAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      setupPartialTransaction(tx, PARTIAL_TYPES.ESSENTIAL)

      const rootSegment = agent.tracer.getSegment()

      // this span will be kept since it's an exit span (message broker)
      const child1Segment = createSegment(agent, 'child1', 'MessageBroker/api.example.com/users', rootSegment, tx)

      createSpanLink(child1Segment, 'span1', 'trace1', 'parent1', 'trace1', 'test1')

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')

      addRootSegment(spanEventAggregator, tx, rootSegment)
      // root span has no span links
      assert.equal(rootSegment.spanLinks.length, 0)

      // simulate that the segment has entity relationship attrs to keep the span
      const hasEntityStub = stubEntityRelationship(true)

      addChildSegment(spanEventAggregator, tx, child1Segment, rootSegment.id)
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
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[0].userAttributes).length, 0)
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[0].agentAttributes).length, 0)
      end()
    })
  })

  await t.test('span link moved to nearest parent and non intrinsics attrs removed when using essential tracing', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      setupPartialTransaction(tx, PARTIAL_TYPES.ESSENTIAL)

      const rootSegment = agent.tracer.getSegment()

      // this span will be kept since it's an exit span (message broker)
      const child1Segment = createSegment(agent, 'child1', 'MessageBroker/api.example.com/users', rootSegment, tx)

      // this span will be dropped since it's not an exit span
      const child2Segment = createSegment(agent, 'child2', 'child2-segment', child1Segment, tx)

      createSpanLink(child1Segment, 'span1', 'trace1', 'parent1', 'trace1', 'test1')
      createSpanLink(child2Segment, 'span2', 'trace2', 'parent2', 'trace1', 'test2')

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child2Segment.spanLinks[0].intrinsics.id, 'span2')

      addRootSegment(spanEventAggregator, tx, rootSegment)
      // root span has no span links
      assert.equal(rootSegment.spanLinks.length, 0)

      // simulate that the segment has entity relationship attrs to keep the span
      const hasEntityStub = stubEntityRelationship(true)

      addChildSegment(spanEventAggregator, tx, child1Segment, rootSegment.id)
      hasEntityStub.restore()
      addChildSegment(spanEventAggregator, tx, child2Segment, child1Segment.id)

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
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[0].userAttributes).length, 0)
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[1].userAttributes).length, 0)
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[0].agentAttributes).length, 0)
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[1].agentAttributes).length, 0)
      end()
    })
  })

  await t.test('span links compressed to one kept span if there are multiple spans for the same entity when using compact tracing', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      setupPartialTransaction(tx, PARTIAL_TYPES.COMPACT)

      const reparentSpanLinkSpy = sinon.spy(tx.partialTrace, 'reparentSpanLinks')
      const rootSegment = agent.tracer.getSegment()

      // first exit span to a message broker
      const child1Segment = createSegment(agent, 'child1', 'MessageBroker/api.example.com/users', rootSegment, tx)

      // entry span to another service
      const child2Segment = createSegment(agent, 'child2', 'child2-segment', child1Segment, tx)

      // second exit span to the same message broker
      const child3Segment = createSegment(agent, 'child3', 'MessageBroker/api.example.com/users', rootSegment, tx)

      // entry span to another service
      const child4Segment = createSegment(agent, 'child4', 'child4-segment', child3Segment, tx)

      createSpanLink(child1Segment, 'span1', 'trace1', 'parent1', 'trace1', 'test1')
      createSpanLink(child3Segment, 'span1', 'trace1', 'parent1', 'trace1', 'test2')

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child3Segment.spanLinks[0].intrinsics.id, 'span1')

      addRootSegment(spanEventAggregator, tx, rootSegment)
      tx.baseSegment = rootSegment

      // simulate that the segment has entity relationship attrs to keep the span
      const hasEntityStub = stubEntityRelationship(true)

      addChildSegment(spanEventAggregator, tx, child1Segment, rootSegment.id)
      addChildSegment(spanEventAggregator, tx, child2Segment, child1Segment.id, true)
      addChildSegment(spanEventAggregator, tx, child3Segment, rootSegment.id)
      addChildSegment(spanEventAggregator, tx, child4Segment, child3Segment.id, true)
      hasEntityStub.restore()

      tx.partialTrace.finalize()

      assert.equal(reparentSpanLinkSpy.callCount, 1)

      const events = tx.agent.spanEventAggregator.getEvents()
      const compressedExitSpan = events.find((span) => span.intrinsics.name === 'MessageBroker/api.example.com/users')

      // only one compressed exit span for the same entity with two span links now
      assert.equal(compressedExitSpan.spanLinks.length, 2)
      assert.equal(compressedExitSpan.spanLinks[1].intrinsics.id, compressedExitSpan.id)

      // non instrincs attrs are removed on compact partial traces
      assert.equal(Object.keys(compressedExitSpan.spanLinks[1].userAttributes).length, 0)
      assert.equal(Object.keys(compressedExitSpan.spanLinks[1].agentAttributes).length, 0)
      end()
    })
  })

  await t.test('move span links in compact for non exit spans with entity relationship attributes', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      setupPartialTransaction(tx, PARTIAL_TYPES.COMPACT)

      const rootSegment = agent.tracer.getSegment()

      // exit span to message broker
      const child1Segment = createSegment(agent, 'child1', 'MessageBroker/api.example.com/users', rootSegment, tx)

      // entry span to another service
      const child2Segment = createSegment(agent, 'child2', 'child2-segment', rootSegment, tx)

      createSpanLink(child1Segment, 'span1', 'trace1', 'parent1', 'trace1', 'test1')
      createSpanLink(child2Segment, 'span1', 'trace1', 'parent1', 'trace1', 'test2')

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(child2Segment.spanLinks[0].intrinsics.id, 'span1')

      addRootSegment(spanEventAggregator, tx, rootSegment)

      // simulate that the segment has entity relationship attrs to keep the span
      const hasEntityStub = stubEntityRelationship(true)

      addChildSegment(spanEventAggregator, tx, child1Segment, rootSegment.id)
      addChildSegment(spanEventAggregator, tx, child2Segment, rootSegment.id)
      hasEntityStub.restore()

      // one span with span links dropped move to nearest parent
      const keptSpanWithLinks = tx.partialTrace.spans[1]
      assert.equal(keptSpanWithLinks.spanLinks.length, 2)

      assert.equal(keptSpanWithLinks.spanLinks[1].intrinsics.id, keptSpanWithLinks.id)

      // non instrincs attrs are removed on compact partial traces
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[1].userAttributes).length, 0)
      assert.equal(Object.keys(keptSpanWithLinks.spanLinks[1].agentAttributes).length, 0)
      end()
    })
  })

  await t.test('move span links in compact for non exit spans with no entity relationship attributes', (t, end) => {
    const { agent, spanEventAggregator } = t.nr
    helper.runInTransaction(agent, (tx) => {
      setupPartialTransaction(tx, PARTIAL_TYPES.COMPACT)

      const rootSegment = agent.tracer.getSegment()

      // exit span to message broker
      const child1Segment = createSegment(agent, 'child1', 'MessageBroker/api.example.com/users', rootSegment, tx)

      createSpanLink(child1Segment, 'span1', 'trace1', 'parent1', 'trace1', 'test1')

      // span link id is initially set to the span id in the context they are created on
      assert.equal(child1Segment.spanLinks[0].intrinsics.id, 'span1')
      assert.equal(rootSegment.spanLinks.length, 0)

      addRootSegment(spanEventAggregator, tx, rootSegment)

      // simulate that the segment has no entity relationship attrs to drop the span
      const hasEntityStub = stubEntityRelationship(false)

      addChildSegment(spanEventAggregator, tx, child1Segment, rootSegment.id)
      hasEntityStub.restore()

      // only one kept span
      assert.equal(tx.partialTrace.spans.length, 1)

      // one span with span links dropped move to nearest parent
      const keptSpan = tx.partialTrace.spans[0]
      assert.equal(keptSpan.spanLinks.length, 1)

      assert.equal(keptSpan.spanLinks[0].intrinsics.id, keptSpan.id)

      // non instrincs attrs are removed on compact partial traces
      assert.equal(Object.keys(keptSpan.spanLinks[0].userAttributes).length, 0)
      assert.equal(Object.keys(keptSpan.spanLinks[0].agentAttributes).length, 0)
      end()
    })
  })
})
