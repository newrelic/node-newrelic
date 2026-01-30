/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const SpanLink = require('#agentlib/spans/span-link.js')
const SpanEvent = require('#agentlib/spans/span-event.js')
const sinon = require('sinon')
const assert = require('node:assert')

const TIMESTAMP = 1765285200000 // 2025-12-09T09:00:00.000-04:00

function setupPartialTransaction(tx, partialType) {
  tx.priority = 42
  tx.sampled = true
  tx.partialType = partialType
  tx.createPartialTrace()
}

function createSpanLink({ segment, spanId, traceId, linkSpanId, linkTraceId, testAttr }) {
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

function addSegment({ spanEventAggregator, tx, segment, parentId = '1', isEntry = false }) {
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

function setupPartialTrace({ agent, partialType, tx, addRootSpanLink = false, add99SpanLinks = false, addExitSpan = false, numOfChildSegments = 2 }) {
  setupPartialTransaction(tx, partialType)

  // setup root segment and span links on root if needed
  const rootSegment = agent.tracer.getSegment()

  if (add99SpanLinks) {
    for (let i = 0; i < 99; i += 1) {
      rootSegment.addSpanLink({ fake: 'link' })
    }
  }

  if (addRootSpanLink) {
    createSpanLink({ segment: rootSegment, spanId: rootSegment.id, traceId: 'trace1', linkSpanId: rootSegment.id, linkTraceId: 'trace1', testAttr: 'rootTest' })
  }

  // setup child 2 segment with span link
  const child1Name = addExitSpan ? 'MessageBroker/api.example.com/users' : 'child1-segment'
  const child1Segment = createSegment(agent, 'child1', child1Name, rootSegment, tx)
  createSpanLink({ segment: child1Segment, spanId: 'span1', traceId: 'trace1', linkSpanId: 'parent1', linkTraceId: 'trace1', testAttr: 'test1' })

  if (numOfChildSegments === 1) {
    return { rootSegment, child1Segment }
  }

  // setup child 2 sgement with span links if needed
  const child2Segment = createSegment(agent, 'child2', 'child2-segment', child1Segment, tx)
  createSpanLink({ segment: child2Segment, spanId: 'span2', traceId: 'trace2', linkSpanId: 'parent2', linkTraceId: 'trace1', testAttr: 'test2' })

  return { rootSegment, child1Segment, child2Segment }
}

function setupPartialTraceForCompactCompression(agent, tx) {
  setupPartialTransaction(tx, 'compact')

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

  createSpanLink({ segment: child1Segment, spanId: 'span1', traceId: 'trace1', linkSpanId: 'parent1', linkTraceId: 'trace1', testAttr: 'test1' })
  createSpanLink({ segment: child3Segment, spanId: 'span1', traceId: 'trace1', linkSpanId: 'parent1', linkTraceId: 'trace1', testAttr: 'test2' })

  return { rootSegment, child1Segment, child2Segment, child3Segment, child4Segment, reparentSpanLinkSpy }
}

function addSegmentsForCompactCompression({ spanEventAggregator, tx, segments }) {
  addSegment({ spanEventAggregator, tx, segment: segments.rootSegment, isEntry: true })
  tx.baseSegment = segments.rootSegment

  // simulate that the segment has entity relationship attrs to keep the span
  const hasEntityStub = stubEntityRelationship(true)

  addSegment({ spanEventAggregator, tx, segment: segments.child1Segment, parentId: segments.rootSegment.id })
  addSegment({ spanEventAggregator, tx, segment: segments.child2Segment, parentId: segments.child1Segment.id, isEntry: true })
  addSegment({ spanEventAggregator, tx, segment: segments.child3Segment, parentId: segments.rootSegment.id })
  addSegment({ spanEventAggregator, tx, segment: segments.child4Segment, parentId: segments.child3Segment.id, isEntry: true })
  hasEntityStub.restore()
}

function assertSpanLinkAttributes(spanLinks) {
  for (let i = 0; i < spanLinks.length; i += 1) {
    const link = spanLinks[i]
    assert.equal(Object.keys(link.userAttributes).length, 0)
    assert.equal(Object.keys(link.agentAttributes).length, 0)
  }
}

module.exports = {
  setupPartialTrace,
  stubEntityRelationship,
  assertSpanLinkAttributes,
  addSegment,
  createSegment,
  createSpanLink,
  setupPartialTraceForCompactCompression,
  addSegmentsForCompactCompression
}
