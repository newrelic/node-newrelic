/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const { describe, test } = require('node:test')
const helper = require('#testlib/agent_helper.js')
const sinon = require('sinon')
const Transaction = require('#agentlib/transaction/index.js')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const transaction = new Transaction(agent)
  transaction.createPartialTrace()
  ctx.nr = {
    agent,
    transaction,
    partialTrace: transaction.partialTrace,
    trace: transaction.trace
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

describe('addSpan', () => {
  test('should add span to array when `addSpan` is called and span is present', (t) => {
    const { partialTrace } = t.nr
    assert.deepEqual(partialTrace.spans, [])
    const spanDetails = { key: 'value' }
    const span = { applyPartialTraceRules() { return spanDetails } }
    partialTrace.addSpan({ span })
    assert.deepEqual(partialTrace.spans, [spanDetails])
    assert.equal(partialTrace.droppedSpans.size, 0)
  })

  test('should not add span to array, instead add id mapping to `partialTrace.droppedSpans` when `addSpan` is called and span is not present', (t) => {
    const { partialTrace } = t.nr
    partialTrace.type = Transaction.PARTIAL_TYPES.REDUCED
    assert.deepEqual(partialTrace.spans, [])
    const span = { id: 1, parentId: 0, applyPartialTraceRules() {} }
    partialTrace.addSpan({ span })
    assert.deepEqual(partialTrace.spans, [])
    assert.equal(partialTrace.droppedSpans.size, 1)
    assert.equal(partialTrace.droppedSpans.get(1), 0)
  })

  test('should not add span to array nor id mapping to `partialTrace.droppedSpans` when it is a compact partial trace', (t) => {
    const { partialTrace } = t.nr
    partialTrace.type = Transaction.PARTIAL_TYPES.COMPACT
    assert.deepEqual(partialTrace.spans, [])
    const span = { id: 1, parentId: 0, applyPartialTraceRules() {} }
    partialTrace.addSpan({ span })
    assert.deepEqual(partialTrace.spans, [])
    assert.equal(partialTrace.droppedSpans.size, 0)
  })
})

describe('finalize', () => {
  test('should call maybeReparentSpan and add spans to aggregator in reduced type', (t) => {
    const { agent, partialTrace } = t.nr
    const addSpy = sinon.spy(agent.spanAggregator, 'add')
    const maybeReparentSpanSpy = sinon.spy(partialTrace, 'maybeReparentSpan')
    const applyCompactionSpy = sinon.spy(partialTrace, 'applyCompaction')

    partialTrace.type = Transaction.PARTIAL_TYPES.REDUCED
    partialTrace.droppedSpans.set(3, 4)
    partialTrace.spans = [1, 2]
    partialTrace.finalize()
    assert.equal(addSpy.callCount, 2)
    assert.equal(maybeReparentSpanSpy.callCount, 2)
    assert.equal(applyCompactionSpy.callCount, 0)
    assert.deepEqual(partialTrace.spans, [])
    assert.equal(partialTrace.droppedSpans.size, 0)
    assert.deepEqual(partialTrace.compactSpanGroups, {})
  })

  test('should call applyCompaction and add spans to aggregator in compact type', (t) => {
    const { agent, partialTrace, transaction } = t.nr
    transaction.baseSegment = { id: 100 }
    const addSpy = sinon.spy(agent.spanAggregator, 'add')
    const maybeReparentSpanSpy = sinon.spy(partialTrace, 'maybeReparentSpan')
    const applyCompactionSpy = sinon.spy(partialTrace, 'applyCompaction')

    partialTrace.type = Transaction.PARTIAL_TYPES.COMPACT
    const now = Date.now()
    const span1 = {
      id: 1,
      intrinsics: { timestamp: now, duration: 5 },
      addIntrinsicAttribute: sinon.spy()
    }
    const span2 = { id: 2, intrinsics: { timestamp: now, duration: 5 } } // duration is 5
    partialTrace.spans = [span1]
    partialTrace.compactSpanGroups[1] = [span1, span2]
    partialTrace.finalize()
    assert.equal(addSpy.callCount, 1)
    assert.equal(maybeReparentSpanSpy.callCount, 0)
    assert.equal(applyCompactionSpy.callCount, 1)
    assert.deepEqual(partialTrace.spans, [])
    assert.equal(partialTrace.droppedSpans.size, 0)
    assert.deepEqual(partialTrace.compactSpanGroups, {})
  })
})

describe('maybeReparentSpan', () => {
  test('should reparent span to grandparent if its parent was dropped', (t) => {
    const { partialTrace } = t.nr
    let newParent
    partialTrace.droppedSpans.set(1, 4)
    const span = {
      parentId: 1,
      addIntrinsicAttribute: function(key, value) {
        newParent = value
      }
    }
    partialTrace.maybeReparentSpan(span)
    assert.equal(newParent, 4)
  })

  test('should reparent span to 6 levels if 5 parents above were dropped', (t) => {
    const { partialTrace } = t.nr
    let newParent
    partialTrace.droppedSpans.set(1, 2)
    partialTrace.droppedSpans.set(2, 3)
    partialTrace.droppedSpans.set(3, 4)
    partialTrace.droppedSpans.set(4, 5)
    partialTrace.droppedSpans.set(5, 6)
    const span = {
      parentId: 1,
      addIntrinsicAttribute: function(key, value) {
        newParent = value
      }
    }

    partialTrace.maybeReparentSpan(span)
    assert.equal(newParent, 6)
  })

  test('should not reparent span if parent id is not in droppedSpans', (t) => {
    const { partialTrace } = t.nr
    let newParent = null
    partialTrace.droppedSpans.set(2, 1)
    const span = {
      parentId: 1,
      addIntrinsicAttribute: function(key, value) {
        newParent = value
      }
    }

    partialTrace.maybeReparentSpan(span)
    assert.equal(newParent, null)
  })
})

describe('applyCompaction', () => {
  test('should properly handle overlapping and non-overlapping durations', (t) => {
    const { partialTrace, transaction } = t.nr
    transaction.baseSegment = { id: 100 }
    const now = Date.now()
    const span1 = {
      id: 1,
      intrinsics: { timestamp: now, duration: 5 },
      addIntrinsicAttribute: sinon.spy()
    }
    const span2 = { id: 2, intrinsics: { timestamp: now, duration: 5 } } // duration is 5
    const span3 = { id: 3, intrinsics: { timestamp: now, duration: 7 } } // duration is 7
    const span4 = { id: 4, intrinsics: { timestamp: now + 5000, duration: 3 } } // duration is 8
    const span5 = { id: 5, intrinsics: { timestamp: now + 10000, duration: 10 } } // duration is 18
    partialTrace.compactSpanGroups[1] = [span1, span5, span3, span4, span2]
    partialTrace.applyCompaction(span1)
    assert.equal(transaction.metrics.unscoped['Supportability/Nodejs/PartialGranularity/NrIds/Dropped'].callCount, 4)
    assert.equal(span1.addIntrinsicAttribute.callCount, 3)
    assert.deepEqual(span1.addIntrinsicAttribute.args, [
      ['parentId', 100],
      ['nr.ids', [3, 2, 4, 5]],
      ['nr.durations', 18]
    ])
  })

  test('should exit early if current span is only span in trace.compactSpanGroups', (t) => {
    const { partialTrace, transaction } = t.nr
    transaction.baseSegment = { id: 100 }
    const now = Date.now()
    const span1 = {
      id: 1,
      intrinsics: { timestamp: now, duration: 5 },
      addIntrinsicAttribute: sinon.spy()
    }
    partialTrace.compactSpanGroups[1] = [span1]
    partialTrace.applyCompaction(span1)
    assert.ok(!transaction.metrics.unscoped['Supportability/Nodejs/PartialGranularity/NrIds/Dropped'])
    assert.equal(span1.addIntrinsicAttribute.callCount, 1)
    assert.deepEqual(span1.addIntrinsicAttribute.args[0], ['parentId', 100])
  })

  test('should exit early if not span does not need compaction', (t) => {
    const { partialTrace, transaction } = t.nr
    const now = Date.now()
    const span1 = {
      id: 1,
      intrinsics: { timestamp: now, duration: 5 },
      addIntrinsicAttribute: sinon.spy()
    }

    partialTrace.applyCompaction(span1)
    assert.ok(!transaction.metrics.unscoped['Supportability/Nodejs/PartialGranularity/NrIds/Dropped'])
    assert.equal(span1.addIntrinsicAttribute.callCount, 0)
  })

  test('should store the last error if multiple exist', (t) => {
    const { partialTrace, transaction } = t.nr
    transaction.baseSegment = { id: 100 }
    const now = Date.now()
    const span1 = {
      id: 1,
      intrinsics: { timestamp: now, duration: 5 },
      hasErrorAttrs: true,
      errorAttrs: { 'error.class': 'FirstError' },
      addAttribute: sinon.spy(),
      addIntrinsicAttribute: sinon.spy()
    }
    const span2 = { id: 4, intrinsics: { timestamp: now + 5000, duration: 3, }, hasErrorAttrs: true, errorAttrs: { 'error.class': 'SecondError' } }
    const span3 = { id: 5, intrinsics: { timestamp: now + 10000, duration: 10 } }
    partialTrace.compactSpanGroups[1] = [span1, span2, span3]
    partialTrace.applyCompaction(span1)
    assert.equal(span1.addAttribute.callCount, 1)
    assert.deepEqual(span1.addAttribute.args[0], ['error.class', 'SecondError', false])
  })

  test('should store the last error if multiple exist', (t) => {
    const { partialTrace, transaction } = t.nr
    transaction.baseSegment = { id: 100 }
    const now = Date.now()
    const span1 = {
      id: 1,
      intrinsics: { timestamp: now, duration: 5 },
      hasErrorAttrs: true,
      errorAttrs: { 'error.class': 'FirstError' },
      addAttribute: sinon.spy(),
      addIntrinsicAttribute: sinon.spy()
    }
    const span2 = { id: 4, intrinsics: { timestamp: now + 5000, duration: 3, }, hasErrorAttrs: false }
    const span3 = { id: 5, intrinsics: { timestamp: now + 10000, duration: 10 }, hasErrorAttrs: false }
    partialTrace.compactSpanGroups[1] = [span1, span2, span3]
    partialTrace.applyCompaction(span1)
    assert.equal(span1.addAttribute.callCount, 1)
    assert.deepEqual(span1.addAttribute.args[0], ['error.class', 'FirstError', false])
  })

  test('should store the first error if other errors happened before', (t) => {
    const { partialTrace, transaction } = t.nr
    transaction.baseSegment = { id: 100 }
    const now = Date.now()
    const span1 = {
      id: 1,
      intrinsics: { timestamp: now, duration: 5 },
      hasErrorAttrs: true,
      errorAttrs: { 'error.class': 'FirstError' },
      addAttribute: sinon.spy(),
      addIntrinsicAttribute: sinon.spy()
    }
    const span2 = { id: 4, intrinsics: { timestamp: now - 5000, duration: 3, }, hasErrorAttrs: true, errorAttrs: { 'error.class': 'SecondError' } }
    const span3 = { id: 5, intrinsics: { timestamp: now - 10000, duration: 10 }, hasErrorAttrs: true, errorAttrs: { 'error.class': 'ThirdError' } }
    partialTrace.compactSpanGroups[1] = [span1, span2, span3]
    partialTrace.applyCompaction(span1)
    assert.equal(span1.addAttribute.callCount, 1)
    assert.deepEqual(span1.addAttribute.args[0], ['error.class', 'FirstError', false])
  })

  test('should not store error if none exist', (t) => {
    const { partialTrace, transaction } = t.nr
    transaction.baseSegment = { id: 100 }
    const now = Date.now()
    const span1 = {
      id: 1,
      intrinsics: { timestamp: now, duration: 5 },
      hasErrorAttrs: false,
      addAttribute: sinon.spy(),
      addIntrinsicAttribute: sinon.spy()
    }
    const span2 = { id: 4, intrinsics: { timestamp: now + 5000, duration: 3, }, hasErrorAttrs: false }
    const span3 = { id: 5, intrinsics: { timestamp: now + 10000, duration: 10 }, hasErrorAttrs: false }
    partialTrace.compactSpanGroups[1] = [span1, span2, span3]
    partialTrace.applyCompaction(span1)
    assert.equal(span1.addAttribute.callCount, 0)
  })
})
