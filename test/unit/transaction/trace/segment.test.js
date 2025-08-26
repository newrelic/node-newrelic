/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint dot-notation: off */
'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const sinon = require('sinon')
const helper = require('#testlib/agent_helper.js')
const TraceSegment = require('#agentlib/transaction/trace/segment.js')
const Transaction = require('#agentlib/transaction/index.js')
const hashes = require('#agentlib/util/hashes.js')
const urltils = require('#agentlib/util/urltils.js')

function beforeEach(ctx) {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
  ctx.nr.agent.config.logging.diagnostics = true
}

function afterEach(ctx) {
  helper.unloadAgent(ctx.nr.agent)
}

test('TraceSegment', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('has a name', (t) => {
    const { agent } = t.nr
    const trans = new Transaction(agent)
    const root = trans.trace.root
    const success = new TraceSegment({
      config: agent.config,
      name: 'UnitTest',
      collect: true,
      root
    })
    assert.equal(success.name, 'UnitTest')
  })

  await t.test('has a timer', (t) => {
    const { agent } = t.nr
    const trans = new Transaction(agent)
    const root = trans.trace.root
    const segment = new TraceSegment({
      config: agent.config,
      name: 'UnitTest',
      collect: true,
      root
    })
    assert.ok(segment.timer)
  })

  await t.test('does not start its timer on creation', (t) => {
    const { agent } = t.nr
    const trans = new Transaction(agent)
    const root = trans.trace.root
    const segment = new TraceSegment({
      config: agent.config,
      name: 'UnitTest',
      collect: true,
      root
    })
    assert.equal(segment.timer.isRunning(), false)
  })

  await t.test('does not crash when calculating exclusive time', (t) => {
    const { agent } = t.nr
    const trans = new Transaction(agent)
    const root = trans.trace.root
    const segment = new TraceSegment({
      config: agent.config,
      name: 'UnitTest',
      collect: true,
      root
    })
    segment.start()
    segment.touch()
    const duration = segment.getExclusiveDurationInMillis(trans.trace)
    assert.ok(duration > 0)
  })

  await t.test('allows the timer to be updated without ending it', (t) => {
    const { agent } = t.nr
    const trans = new Transaction(agent)
    const root = trans.trace.root
    const segment = new TraceSegment({
      config: agent.config,
      name: 'UnitTest',
      collect: true,
      root
    })
    segment.start()
    segment.touch()
    assert.equal(segment.timer.isRunning(), true)
    assert.ok(segment.getDurationInMillis() > 0)
  })

  await t.test('uses id passed in instead of unique id', (t) => {
    const { agent } = t.nr
    const trans = new Transaction(agent)
    const root = trans.trace.root
    const id = hashes.makeId()
    const segment = new TraceSegment({
      id,
      config: agent.config,
      name: 'UnitTest',
      collect: true,
      root
    })
    assert.equal(segment.id, id)
  })

  await t.test('should return the segment id when dt and spans are enabled', (t) => {
    const { agent } = t.nr
    const trans = new Transaction(agent)
    const root = trans.trace.root
    const segment = new TraceSegment({
      config: agent.config,
      name: 'Test',
      collect: true,
      root
    })
    agent.config.distributed_tracing.enabled = true
    agent.config.span_events.enabled = true
    assert.equal(segment.getSpanId(), segment.id)
  })

  await t.test('should return null when dt is disabled', (t) => {
    const { agent } = t.nr
    const trans = new Transaction(agent)
    const root = trans.trace.root
    agent.config.distributed_tracing.enabled = false
    agent.config.span_events.enabled = true
    const segment = new TraceSegment({
      config: agent.config,
      name: 'Test',
      collect: true,
      root
    })
    assert.equal(segment.getSpanId(), null)
  })

  await t.test('should return null when spans are disabled', (t) => {
    const { agent } = t.nr
    const trans = new Transaction(agent)
    const root = trans.trace.root
    agent.config.distributed_tracing.enabled = true
    agent.config.span_events.enabled = false
    const segment = new TraceSegment({
      config: agent.config,
      name: 'Test',
      collect: true,
      root
    })
    assert.ok(segment.getSpanId() === null)
  })

  await t.test('updates root segment timer when end() is called', (t, end) => {
    const { agent } = t.nr
    const trans = new Transaction(agent)
    const trace = trans.trace
    const root = trace.root
    const segment = new TraceSegment({
      config: agent.config,
      name: 'Test',
      collect: true,
      root
    })

    segment.setDurationInMillis(10, 0)

    setTimeout(() => {
      assert.equal(trace.root.timer.hrDuration, null)
      segment.end()
      assert.ok(trace.root.timer.getDurationInMillis() > segment.timer.getDurationInMillis() - 1) // alow for slop
      end()
    }, 10)
  })

  await t.test('toJSON should not modify attributes', (t) => {
    const { agent } = t.nr
    const transaction = new Transaction(agent)
    const root = transaction.trace.root
    const segment = new TraceSegment({
      config: agent.config,
      name: 'TestSegment',
      collect: true,
      root
    })
    transaction.trace.toJSON()
    assert.deepEqual(segment.getAttributes(), {})
  })

  await t.test('when ended stops its timer', (t) => {
    const { agent } = t.nr
    const trans = new Transaction(agent)
    const root = trans.trace.root
    const segment = new TraceSegment({
      config: agent.config,
      name: 'UnitTest',
      collect: true,
      root
    })
    segment.end()
    assert.equal(segment.timer.isRunning(), false)
  })

  await t.test('should produce JSON that conforms to the collector spec', (t) => {
    const { agent } = t.nr
    const transaction = new Transaction(agent)
    const trace = transaction.trace
    const segment = trace.add('DB/select/getSome')

    trace.setDurationInMillis(17, 0)
    segment.setDurationInMillis(14, 3)

    trace.end()

    // get serialized segment from trace
    const serializedSegment = trace.toJSON()[4][0]
    assert.deepEqual(serializedSegment, [
      3,
      17,
      'DB/select/getSome',
      { nr_exclusive_duration_millis: 14 },
      []
    ])
  })

  await t.test('#finalize should add nr_exclusive_duration_millis attribute', (t) => {
    const { agent } = t.nr
    const transaction = new Transaction(agent)
    const root = transaction.trace.root
    const segment = new TraceSegment({
      config: agent.config,
      name: 'TestSegment',
      collect: true,
      root,
      parentId: root.id
    })

    transaction.trace.segments.add(segment)
    segment._setExclusiveDurationInMillis(1)

    assert.deepEqual(segment.getAttributes(), {})

    segment.finalize(transaction.trace)

    assert.equal(segment.getAttributes()['nr_exclusive_duration_millis'], 1)
  })

  await t.test('should truncate when timer still running', (t) => {
    const { agent } = t.nr
    const segmentName = 'TestSegment'

    const transaction = new Transaction(agent)
    const root = transaction.trace.root
    const segment = new TraceSegment({
      config: agent.config,
      name: segmentName,
      collect: true,
      root,
      parentId: root.id
    })

    transaction.trace.segments.add(segment)

    // Force truncation
    sinon.stub(segment.timer, 'softEnd').returns(true)
    sinon.stub(segment.timer, 'endsAfter').returns(true)

    // Make root duration calculation predictable
    root.timer.start = 1000
    segment.timer.start = 1001
    segment.overwriteDurationInMillis(3)

    segment.finalize(transaction.trace)

    assert.equal(segment.name, `Truncated/${segmentName}`)
    assert.equal(root.getDurationInMillis(), 4)
  })
})

test('with children created from URLs', async (t) => {
  t.beforeEach((ctx) => {
    beforeEach(ctx)
    ctx.nr.agent.config.attributes.enabled = true
    ctx.nr.agent.config.attributes.include.push('request.parameters.*')
    ctx.nr.agent.config.emit('attributes.include')

    const transaction = new Transaction(ctx.nr.agent)
    const trace = transaction.trace
    const url = new URL('http://localhost/test?test1=value1&test2&test3=50&test4=')
    transaction.url = url.pathname

    const webChild = trace.add(url)
    transaction.baseSegment = webChild
    transaction.addRequestParameters(urltils.parseParameters(url))
    transaction.finalizeNameFromWeb(200)

    trace.setDurationInMillis(1, 0)
    webChild.setDurationInMillis(1, 0)

    trace.end()
    ctx.nr.webChild = webChild
    ctx.nr.trace = trace
  })

  t.afterEach(afterEach)

  await t.test('should return the URL minus any query parameters', (t) => {
    const { webChild } = t.nr
    assert.equal(webChild.name, 'WebTransaction/NormalizedUri/*')
  })

  await t.test('should have attributes on the child segment', (t) => {
    const { webChild } = t.nr
    assert.ok(webChild.getAttributes())
  })

  await t.test('should have the parameters that were passed in the query string', (t) => {
    const { webChild } = t.nr
    const attributes = webChild.getAttributes()
    assert.equal(attributes['request.parameters.test1'], 'value1')
    assert.equal(attributes['request.parameters.test3'], '50')
  })

  await t.test('should set bare parameters to true (as in present)', (t) => {
    const { webChild } = t.nr
    assert.equal(webChild.getAttributes()['request.parameters.test2'], true)
  })

  await t.test('should set parameters with empty values to ""', (t) => {
    const { webChild } = t.nr
    assert.equal(webChild.getAttributes()['request.parameters.test4'], '')
  })

  await t.test('should serialize the segment with the parameters', (t) => {
    const { trace } = t.nr
    // get serialized segment from trace
    const serializedSegment = trace.toJSON()[4][0]
    assert.deepEqual(serializedSegment, [
      0,
      1,
      'WebTransaction/NormalizedUri/*',
      {
        nr_exclusive_duration_millis: 1,
        'request.parameters.test1': 'value1',
        'request.parameters.test2': true,
        'request.parameters.test3': '50',
        'request.parameters.test4': ''
      },
      []
    ])
  })
})

test('with parameters parsed out by framework', async (t) => {
  t.beforeEach((ctx) => {
    beforeEach(ctx)
    ctx.nr.agent.config.attributes.enabled = true

    const transaction = new Transaction(ctx.nr.agent)
    const trace = transaction.trace
    trace.mer = 6

    const url = '/test'
    const params = {}

    // Express uses positional parameters sometimes
    params[0] = 'first'
    params[1] = 'another'
    params.test3 = '50'

    const webChild = trace.add(url)
    transaction.trace.attributes.addAttributes(DESTINATIONS.TRANS_SCOPE, params)
    transaction.baseSegment = webChild
    transaction.url = url
    transaction.finalizeNameFromWeb(200)

    trace.setDurationInMillis(1, 0)
    webChild.setDurationInMillis(1, 0)

    trace.end()
    ctx.nr.webChild = webChild
    ctx.nr.trace = trace
  })
  t.afterEach(afterEach)

  await t.test('should return the URL minus any query parameters', (t) => {
    const { webChild } = t.nr
    assert.equal(webChild.name, 'WebTransaction/NormalizedUri/*')
  })

  await t.test('should have attributes on the trace', (t) => {
    const { trace } = t.nr
    assert.ok(trace.attributes.get(DESTINATIONS.TRANS_TRACE))
  })

  await t.test('should have the positional parameters from the params array', (t) => {
    const { trace } = t.nr
    const attributes = trace.attributes.get(DESTINATIONS.TRANS_TRACE)
    assert.equal(attributes[0], 'first')
    assert.equal(attributes[1], 'another')
  })

  await t.test('should have the named parameter from the params array', (t) => {
    const { trace } = t.nr
    assert.equal(trace.attributes.get(DESTINATIONS.TRANS_TRACE)['test3'], '50')
  })

  await t.test('should serialize the segment with the parameters', (t) => {
    const { trace } = t.nr
    const expected = [
      0,
      1,
      'WebTransaction/NormalizedUri/*',
      {
        nr_exclusive_duration_millis: 1,
        0: 'first',
        1: 'another',
        test3: '50'
      },
      []
    ]
    // get serialized segment from trace
    const serializedSegment = trace.toJSON()[4][0]
    assert.deepEqual(serializedSegment, expected)
  })
})

test('with attributes.enabled set to false', async (t) => {
  t.beforeEach((ctx) => {
    beforeEach(ctx)
    ctx.nr.agent.config.attributes.enabled = false

    const transaction = new Transaction(ctx.nr.agent)
    const trace = transaction.trace
    const url = '/test?test1=value1&test2&test3=50&test4='

    const webChild = trace.add(url)
    webChild.addAttribute('test', 'non-null value')
    transaction.baseSegment = webChild
    transaction.url = url
    transaction.finalizeNameFromWeb(200)

    trace.setDurationInMillis(1, 0)
    webChild.setDurationInMillis(1, 0)
    ctx.nr.webChild = webChild
    ctx.nr.trace = trace
  })
  t.afterEach(afterEach)

  await t.test('should return the URL minus any query parameters', (t) => {
    const { webChild } = t.nr
    assert.equal(webChild.name, 'WebTransaction/NormalizedUri/*')
  })

  await t.test('should have no attributes on the child segment', (t) => {
    const { webChild } = t.nr
    assert.deepEqual(webChild.getAttributes(), {})
  })

  await t.test('should serialize the segment without the parameters', (t) => {
    const { trace } = t.nr
    const expected = [0, 1, 'WebTransaction/NormalizedUri/*', {}, []]
    // get serialized segment from trace
    const serializedSegment = trace.toJSON()[4][0]
    assert.deepEqual(serializedSegment, expected)
  })
})

test('with attributes.enabled set', async (t) => {
  t.beforeEach((ctx) => {
    beforeEach(ctx)
    ctx.nr.agent.config.attributes.enabled = true
    ctx.nr.agent.config.attributes.include = ['request.parameters.*']
    ctx.nr.agent.config.attributes.exclude = [
      'request.parameters.test1',
      'request.parameters.test4'
    ]
    ctx.nr.agent.config.emit('attributes.exclude')

    const transaction = new Transaction(ctx.nr.agent)
    const trace = transaction.trace
    const url = '/test?test1=value1&test2&test3=50&test4='
    const parsedUrl = new URL('http://localhost' + url)

    const webChild = trace.add(url)
    transaction.baseSegment = webChild
    const params = urltils.parseParameters(parsedUrl)
    transaction.addRequestParameters(params)
    transaction.url = url
    transaction.finalizeNameFromWeb(200)
    webChild.markAsWeb(transaction)

    trace.setDurationInMillis(1, 0)
    webChild.setDurationInMillis(1, 0)
    ctx.nr.attributes = webChild.getAttributes()
    ctx.nr.webChild = webChild

    trace.end()
    ctx.nr.trace = trace
  })
  t.afterEach(afterEach)

  await t.test('should return the URL minus any query parameters', (t) => {
    const { webChild } = t.nr
    assert.equal(webChild.name, 'WebTransaction/NormalizedUri/*')
  })

  await t.test('should have attributes on the child segment', (t) => {
    const { attributes } = t.nr
    assert.ok(attributes)
  })

  await t.test('should filter the parameters that were passed in the query string', (t) => {
    const { attributes } = t.nr
    assert.equal(attributes['test1'], undefined)
    assert.equal(attributes['request.parameters.test1'], undefined)

    assert.equal(attributes['test3'], undefined)
    assert.equal(attributes['request.parameters.test3'], '50')

    assert.equal(attributes['test4'], undefined)
    assert.equal(attributes['request.parameters.test4'], undefined)
  })

  await t.test('should set bare parameters to true (as in present)', (t) => {
    const { attributes } = t.nr
    assert.equal(attributes['test2'], undefined)
    assert.equal(attributes['request.parameters.test2'], true)
  })

  await t.test('should serialize the segment with the parameters', (t) => {
    const { trace } = t.nr
    // get the specific segment from serialized trace
    const serializedSegment = trace.toJSON()[4][0]
    assert.deepEqual(serializedSegment, [
      0,
      1,
      'WebTransaction/NormalizedUri/*',
      {
        nr_exclusive_duration_millis: 1,
        'request.parameters.test2': true,
        'request.parameters.test3': '50'
      },
      []
    ])
  })
})

test('when serialized', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    const transaction = new Transaction(agent)
    const root = transaction.trace.root
    const segment = transaction.trace.add('UnitTest')

    ctx.nr = {
      agent,
      segment,
      transaction,
      root
    }

    ctx.nr.agent.config.logging.diagnostics = true
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should create a plain JS array', (t) => {
    const { segment, transaction } = t.nr
    segment.end()
    const js = transaction.trace.toJSON()[4][0]

    assert.ok(Array.isArray(js))
    assert.equal(typeof js[0], 'number')
    assert.equal(typeof js[1], 'number')

    assert.equal(js[2], 'UnitTest')

    assert.equal(typeof js[3], 'object')

    assert.ok(Array.isArray(js[4]))
    assert.equal(js[4].length, 0)
  })
})

test('getSpanContext', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
    const transaction = new Transaction(agent)
    const root = transaction.trace.root
    const segment = new TraceSegment({
      config: agent.config,
      name: 'UnitTest',
      collect: true,
      root
    })
    ctx.nr = {
      agent,
      segment,
      transaction
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should not initialize with a span context', (t) => {
    const { segment } = t.nr
    assert.ok(!segment._spanContext)
  })

  await t.test('should create a new context when empty', (t) => {
    const { segment } = t.nr
    const spanContext = segment.getSpanContext()
    assert.ok(spanContext)
  })

  await t.test('should not create a new context when empty and DT disabled', (t) => {
    const { agent, transaction } = t.nr
    agent.config.distributed_tracing.enabled = false
    const segment = new TraceSegment({
      config: agent.config,
      name: 'UnitTest',
      collect: true,
      root: transaction.trace.root
    })
    const spanContext = segment.getSpanContext()
    assert.ok(!spanContext)
  })

  await t.test('should not create a new context when empty and Spans disabled', (t) => {
    const { agent, transaction } = t.nr
    agent.config.span_events.enabled = false
    const segment = new TraceSegment({
      config: agent.config,
      name: 'UnitTest',
      collect: true,
      root: transaction.trace.root
    })
    const spanContext = segment.getSpanContext()
    assert.ok(!spanContext)
  })

  await t.test('should return existing span context', (t) => {
    const { segment } = t.nr
    const originalContext = segment.getSpanContext()
    const secondContext = segment.getSpanContext()
    assert.equal(originalContext, secondContext)
  })
})
