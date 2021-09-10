/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint dot-notation: off */
'use strict'

const tap = require('tap')
const DESTINATIONS = require('../../lib/config/attribute-filter').DESTINATIONS
const sinon = require('sinon')
const helper = require('../lib/agent_helper')
const TraceSegment = require('../../lib/transaction/trace/segment')
const Transaction = require('../../lib/transaction')

tap.test('TraceSegment', (t) => {
  t.autoend()
  let agent = null

  t.beforeEach(() => {
    if (agent === null) {
      agent = helper.loadMockedAgent()
    }
  })

  t.afterEach(() => {
    if (agent) {
      helper.unloadAgent(agent)
      agent = null
    }
  })

  t.test('should be bound to a Trace', (t) => {
    let segment = null
    const trans = new Transaction(agent)
    t.throws(function noTrace() {
      segment = new TraceSegment(null, 'UnitTest')
    })
    t.equal(segment, null)

    const success = new TraceSegment(trans, 'UnitTest')
    t.equal(success.transaction, trans)
    trans.end()
    t.end()
  })

  t.test('should not add new children when marked as opaque', (t) => {
    const trans = new Transaction(agent)
    const segment = new TraceSegment(trans, 'UnitTest')
    t.notOk(segment.opaque)
    segment.opaque = true
    segment.add('child')
    t.equal(segment.children.length, 0)
    segment.opaque = false
    segment.add('child')
    t.equal(segment.children.length, 1)
    trans.end()
    t.end()
  })

  t.test('should call an optional callback function', (t) => {
    const trans = new Transaction(agent)
    t.doesNotThrow(function noCallback() {
      new TraceSegment(trans, 'UnitTest') // eslint-disable-line no-new
    })
    const working = new TraceSegment(trans, 'UnitTest', t.end)
    working.end()
    trans.end()
  })

  t.test('has a name', (t) => {
    const trans = new Transaction(agent)
    const success = new TraceSegment(trans, 'UnitTest')
    t.equal(success.name, 'UnitTest')
    t.end()
  })

  t.test('is created with no children', (t) => {
    const trans = new Transaction(agent)
    const segment = new TraceSegment(trans, 'UnitTest')
    t.equal(segment.children.length, 0)
    t.end()
  })

  t.test('has a timer', (t) => {
    const trans = new Transaction(agent)
    const segment = new TraceSegment(trans, 'UnitTest')
    t.ok(segment.timer)
    t.end()
  })

  t.test('does not start its timer on creation', (t) => {
    const trans = new Transaction(agent)
    const segment = new TraceSegment(trans, 'UnitTest')
    t.equal(segment.timer.isRunning(), false)
    t.end()
  })

  t.test('allows the timer to be updated without ending it', (t) => {
    const trans = new Transaction(agent)
    const segment = new TraceSegment(trans, 'UnitTest')
    segment.start()
    segment.touch()
    t.equal(segment.timer.isRunning(), true)
    t.ok(segment.getDurationInMillis() > 0)
    t.end()
  })

  t.test('accepts a callback that records metrics for this segment', (t) => {
    const trans = new Transaction(agent)
    const segment = new TraceSegment(trans, 'Test', (insider) => {
      t.equal(insider, segment)
      return t.end()
    })
    segment.end()
    trans.end()
  })

  t.test('#getSpanId', (t) => {
    t.autoend()

    t.test('should return the segment id when dt and spans are enabled', (t) => {
      const trans = new Transaction(agent)
      const segment = new TraceSegment(trans, 'Test')
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true
      t.equal(segment.getSpanId(), segment.id)
      t.end()
    })

    t.test('should return null when dt is disabled', (t) => {
      const trans = new Transaction(agent)
      const segment = new TraceSegment(trans, 'Test')
      agent.config.distributed_tracing.enabled = false
      agent.config.span_events.enabled = true
      t.equal(segment.getSpanId(), null)
      t.end()
    })

    t.test('should return null when spans are disabled', (t) => {
      const trans = new Transaction(agent)
      const segment = new TraceSegment(trans, 'Test')
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false
      t.ok(segment.getSpanId() === null)
      t.end()
    })
  })

  t.test('updates root segment timer when end() is called', (t) => {
    const trans = new Transaction(agent)
    const trace = trans.trace
    const segment = new TraceSegment(trans, 'Test')

    segment.setDurationInMillis(10, 0)

    setTimeout(() => {
      t.equal(trace.root.timer.hrDuration, null)
      segment.end()
      t.ok(trace.root.timer.getDurationInMillis() > segment.timer.getDurationInMillis() - 1) // alow for slop
      t.end()
    }, 10)
  })

  t.test('properly tracks the number of active or harvested segments', (t) => {
    t.equal(agent.activeTransactions, 0)
    t.equal(agent.totalActiveSegments, 0)
    t.equal(agent.segmentsCreatedInHarvest, 0)

    const tx = new Transaction(agent)
    t.equal(agent.totalActiveSegments, 1)
    t.equal(agent.segmentsCreatedInHarvest, 1)
    t.equal(tx.numSegments, 1)
    t.equal(agent.activeTransactions, 1)

    const segment = new TraceSegment(tx, 'Test') // eslint-disable-line no-unused-vars
    t.equal(agent.totalActiveSegments, 2)
    t.equal(agent.segmentsCreatedInHarvest, 2)
    t.equal(tx.numSegments, 2)
    tx.end()

    t.equal(agent.activeTransactions, 0)

    setTimeout(function () {
      t.equal(agent.totalActiveSegments, 0)
      t.equal(agent.segmentsClearedInHarvest, 2)

      agent.forceHarvestAll(() => {
        t.equal(agent.totalActiveSegments, 0)
        t.equal(agent.segmentsClearedInHarvest, 0)
        t.equal(agent.segmentsCreatedInHarvest, 0)
        t.end()
      })
    }, 10)
  })

  t.test('toJSON should not modify attributes', (t) => {
    const transaction = new Transaction(agent)
    const segment = new TraceSegment(transaction, 'TestSegment')
    segment.toJSON()
    t.same(segment.getAttributes(), {})
    t.end()
  })

  t.test('with children created from URLs', (t) => {
    t.autoend()
    let webChild

    t.beforeEach(() => {
      agent.config.attributes.enabled = true
      agent.config.attributes.include.push('request.parameters.*')
      agent.config.emit('attributes.include')

      const transaction = new Transaction(agent)
      const trace = transaction.trace
      const segment = trace.add('UnitTest')

      const url = '/test?test1=value1&test2&test3=50&test4='

      webChild = segment.add(url)
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)

      trace.end()
    })

    t.test('should return the URL minus any query parameters', (t) => {
      t.equal(webChild.name, 'WebTransaction/NormalizedUri/*')
      t.end()
    })

    t.test('should have attributes on the child segment', (t) => {
      t.ok(webChild.getAttributes())
      t.end()
    })

    t.test('should have the parameters that were passed in the query string', (t) => {
      const attributes = webChild.getAttributes()
      t.equal(attributes['request.parameters.test1'], 'value1')
      t.equal(attributes['request.parameters.test3'], '50')
      t.end()
    })

    t.test('should set bare parameters to true (as in present)', (t) => {
      t.equal(webChild.getAttributes()['request.parameters.test2'], true)
      t.end()
    })

    t.test('should set parameters with empty values to ""', (t) => {
      t.equal(webChild.getAttributes()['request.parameters.test4'], '')
      t.end()
    })

    t.test('should serialize the segment with the parameters', (t) => {
      t.same(webChild.toJSON(), [
        0,
        1,
        'WebTransaction/NormalizedUri/*',
        {
          'nr_exclusive_duration_millis': 1,
          'request.parameters.test1': 'value1',
          'request.parameters.test2': true,
          'request.parameters.test3': '50',
          'request.parameters.test4': ''
        },
        []
      ])
      t.end()
    })
  })

  t.test('with parameters parsed out by framework', (t) => {
    t.autoend()
    let webChild
    let trace

    t.beforeEach(() => {
      agent.config.attributes.enabled = true

      const transaction = new Transaction(agent)
      trace = transaction.trace
      trace.mer = 6

      const segment = trace.add('UnitTest')

      const url = '/test'
      const params = {}

      // Express uses positional parameters sometimes
      params[0] = 'first'
      params[1] = 'another'
      params.test3 = '50'

      webChild = segment.add(url)
      transaction.trace.attributes.addAttributes(DESTINATIONS.TRANS_SCOPE, params)
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)

      trace.end()
    })

    t.test('should return the URL minus any query parameters', (t) => {
      t.equal(webChild.name, 'WebTransaction/NormalizedUri/*')
      t.end()
    })

    t.test('should have attributes on the trace', (t) => {
      t.ok(trace.attributes.get(DESTINATIONS.TRANS_TRACE))
      t.end()
    })

    t.test('should have the positional parameters from the params array', (t) => {
      const attributes = trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      t.equal(attributes[0], 'first')
      t.equal(attributes[1], 'another')
      t.end()
    })

    t.test('should have the named parameter from the params array', (t) => {
      t.equal(trace.attributes.get(DESTINATIONS.TRANS_TRACE)['test3'], '50')
      t.end()
    })

    t.test('should serialize the segment with the parameters', (t) => {
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
      t.same(webChild.toJSON(), expected)
      t.end()
    })
  })

  t.test('with attributes.enabled set to false', (t) => {
    t.autoend()
    let webChild

    t.beforeEach(() => {
      agent.config.attributes.enabled = false

      const transaction = new Transaction(agent)
      const trace = transaction.trace
      const segment = new TraceSegment(transaction, 'UnitTest')
      const url = '/test?test1=value1&test2&test3=50&test4='

      webChild = segment.add(url)
      webChild.addAttribute('test', 'non-null value')
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
    })

    t.test('should return the URL minus any query parameters', (t) => {
      t.equal(webChild.name, 'WebTransaction/NormalizedUri/*')
      t.end()
    })

    t.test('should have no attributes on the child segment', (t) => {
      t.same(webChild.getAttributes(), {})
      t.end()
    })

    t.test('should serialize the segment without the parameters', (t) => {
      const expected = [0, 1, 'WebTransaction/NormalizedUri/*', {}, []]
      t.same(webChild.toJSON(), expected)
      t.end()
    })
  })

  t.test('with attributes.enabled set', (t) => {
    t.autoend()
    let webChild
    let attributes = null

    t.beforeEach(() => {
      agent.config.attributes.enabled = true
      agent.config.attributes.include = ['request.parameters.*']
      agent.config.attributes.exclude = ['request.parameters.test1', 'request.parameters.test4']
      agent.config.emit('attributes.exclude')

      const transaction = new Transaction(agent)
      const trace = transaction.trace
      const segment = trace.add('UnitTest')

      const url = '/test?test1=value1&test2&test3=50&test4='

      webChild = segment.add(url)
      transaction.baseSegment = webChild
      transaction.finalizeNameFromUri(url, 200)
      webChild.markAsWeb(url)

      trace.setDurationInMillis(1, 0)
      webChild.setDurationInMillis(1, 0)
      attributes = webChild.getAttributes()

      trace.end()
    })

    t.test('should return the URL minus any query parameters', (t) => {
      t.equal(webChild.name, 'WebTransaction/NormalizedUri/*')
      t.end()
    })

    t.test('should have attributes on the child segment', (t) => {
      t.ok(attributes)
      t.end()
    })

    t.test('should filter the parameters that were passed in the query string', (t) => {
      t.equal(attributes['test1'], undefined)
      t.equal(attributes['request.parameters.test1'], undefined)

      t.equal(attributes['test3'], undefined)
      t.equal(attributes['request.parameters.test3'], '50')

      t.equal(attributes['test4'], undefined)
      t.equal(attributes['request.parameters.test4'], undefined)
      t.end()
    })

    t.test('should set bare parameters to true (as in present)', (t) => {
      t.equal(attributes['test2'], undefined)
      t.equal(attributes['request.parameters.test2'], true)
      t.end()
    })

    t.test('should serialize the segment with the parameters', (t) => {
      t.same(webChild.toJSON(), [
        0,
        1,
        'WebTransaction/NormalizedUri/*',
        {
          'nr_exclusive_duration_millis': 1,
          'request.parameters.test2': true,
          'request.parameters.test3': '50'
        },
        []
      ])
      t.end()
    })
  })

  t.test('when ended', (t) => {
    t.autoend()

    t.test('stops its timer', (t) => {
      const trans = new Transaction(agent)
      const segment = new TraceSegment(trans, 'UnitTest')
      segment.end()
      t.equal(segment.timer.isRunning(), false)
      t.end()
    })

    t.test('should produce JSON that conforms to the collector spec', (t) => {
      const transaction = new Transaction(agent)
      const trace = transaction.trace
      const segment = trace.add('DB/select/getSome')

      trace.setDurationInMillis(17, 0)
      segment.setDurationInMillis(14, 3)

      trace.end()

      // See documentation on TraceSegment.toJSON for what goes in which field.
      t.same(segment.toJSON(), [
        3,
        17,
        'DB/select/getSome',
        { nr_exclusive_duration_millis: 14 },
        []
      ])
      t.end()
    })
  })

  t.test('#finalize', (t) => {
    t.autoend()

    t.test('should add nr_exclusive_duration_millis attribute', (t) => {
      const transaction = new Transaction(agent)
      const segment = new TraceSegment(transaction, 'TestSegment')

      segment._setExclusiveDurationInMillis(1)

      t.same(segment.getAttributes(), {})

      segment.finalize()

      t.equal(segment.getAttributes()['nr_exclusive_duration_millis'], 1)
      t.end()
    })

    t.test('should truncate when timer still running', (t) => {
      const segmentName = 'TestSegment'

      const transaction = new Transaction(agent)
      const segment = new TraceSegment(transaction, segmentName)

      // Force truncation
      sinon.stub(segment.timer, 'softEnd').returns(true)
      sinon.stub(segment.timer, 'endsAfter').returns(true)

      const root = transaction.trace.root

      // Make root duration calculation predictable
      root.timer.start = 1000
      segment.timer.start = 1001
      segment.overwriteDurationInMillis(3)

      segment.finalize()

      t.equal(segment.name, `Truncated/${segmentName}`)
      t.equal(root.getDurationInMillis(), 4)
      t.end()
    })
  })
})

tap.test('when serialized', (t) => {
  t.autoend()

  let agent = null
  let trans = null
  let segment = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    trans = new Transaction(agent)
    segment = new TraceSegment(trans, 'UnitTest')
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
    trans = null
    segment = null
  })

  t.test('should create a plain JS array', (t) => {
    segment.end()
    const js = segment.toJSON()

    t.ok(Array.isArray(js))
    t.equal(typeof js[0], 'number')
    t.equal(typeof js[1], 'number')

    t.equal(js[2], 'UnitTest')

    t.equal(typeof js[3], 'object')

    t.ok(Array.isArray(js[4]))
    t.equal(js[4].length, 0)

    t.end()
  })

  t.test('should not cause a stack overflow', { timeout: 30000 }, (t) => {
    let parent = segment
    for (let i = 0; i < 9000; ++i) {
      const child = new TraceSegment(trans, 'Child ' + i)
      parent.children.push(child)
      parent = child
    }

    t.doesNotThrow(function () {
      segment.toJSON()
    })

    t.end()
  })
})

tap.test('getSpanContext', (t) => {
  t.autoend()

  let agent = null
  let transaction = null
  let segment = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
    transaction = new Transaction(agent)
    segment = new TraceSegment(transaction, 'UnitTest')
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
    transaction = null
    segment = null
  })

  t.test('should not initialize with a span context', (t) => {
    t.notOk(segment._spanContext)
    t.end()
  })

  t.test('should create a new context when empty', (t) => {
    const spanContext = segment.getSpanContext()
    t.ok(spanContext)
    t.end()
  })

  t.test('should not create a new context when empty and DT disabled', (t) => {
    agent.config.distributed_tracing.enabled = false
    const spanContext = segment.getSpanContext()
    t.notOk(spanContext)
    t.end()
  })

  t.test('should not create a new context when empty and Spans disabled', (t) => {
    agent.config.span_events.enabled = false
    const spanContext = segment.getSpanContext()
    t.notOk(spanContext)
    t.end()
  })

  t.test('should return existing span context', (t) => {
    const originalContext = segment.getSpanContext()
    const secondContext = segment.getSpanContext()
    t.equal(originalContext, secondContext)
    t.end()
  })
})
