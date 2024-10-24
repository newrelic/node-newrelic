/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const util = require('util')
const sinon = require('sinon')
const DESTINATIONS = require('../../../../lib/config/attribute-filter').DESTINATIONS
const helper = require('../../../lib/agent_helper')
const codec = require('../../../../lib/util/codec')
const codecEncodeAsync = util.promisify(codec.encode)
const codecDecodeAsync = util.promisify(codec.decode)
const Segment = require('../../../../lib/transaction/trace/segment')
const DTPayload = require('../../../../lib/transaction/dt-payload')
const Trace = require('../../../../lib/transaction/trace')
const Transaction = require('../../../../lib/transaction')

const NEWRELIC_TRACE_HEADER = 'newrelic'

test('Trace', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should always be bound to a transaction', (t) => {
    const { agent } = t.nr
    assert.throws(() => {
      return new Trace()
    }, /must be associated with a transaction/)

    const transaction = new Transaction(agent)
    const tt = new Trace(transaction)
    assert.ok(tt.transaction instanceof Transaction)
  })

  await t.test('should have the root of a Segment tree', (t) => {
    const { agent } = t.nr
    const tt = new Trace(new Transaction(agent))
    assert.ok(tt.root instanceof Segment)
  })

  await t.test('should be the primary interface for adding segments to a trace', (t) => {
    const { agent } = t.nr
    const transaction = new Transaction(agent)
    const trace = transaction.trace

    assert.doesNotThrow(() => {
      trace.add('Custom/Test17/Child1')
    })
  })

  await t.test('should have DT attributes on transaction end', (t, end) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.primary_application_id = 'test'
    agent.config.account_id = 1
    helper.runInTransaction(agent, function (tx) {
      tx.end()
      const attributes = tx.trace.intrinsics
      assert.equal(attributes.traceId, tx.traceId)
      assert.equal(attributes.guid, tx.id)
      assert.equal(attributes.priority, tx.priority)
      assert.equal(attributes.sampled, tx.sampled)
      assert.equal(attributes.parentId, undefined)
      assert.equal(attributes.parentSpanId, undefined)
      assert.equal(tx.sampled, true)
      assert.ok(tx.priority > 1)
      end()
    })
  })

  await t.test('should have DT parent attributes on payload accept', (t, end) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.primary_application_id = 'test'
    agent.config.account_id = 1
    helper.runInTransaction(agent, function (tx) {
      const payload = tx._createDistributedTracePayload().text()
      tx.isDistributedTrace = null
      tx._acceptDistributedTracePayload(payload)
      tx.end()
      const attributes = tx.trace.intrinsics
      assert.equal(attributes.traceId, tx.traceId)
      assert.equal(attributes.guid, tx.id)
      assert.equal(attributes.priority, tx.priority)
      assert.equal(attributes.sampled, tx.sampled)
      assert.equal(attributes['parent.type'], 'App')
      assert.equal(attributes['parent.app'], agent.config.primary_application_id)
      assert.equal(attributes['parent.account'], agent.config.account_id)
      assert.equal(attributes.parentId, undefined)
      assert.equal(attributes.parentSpanId, undefined)
      assert.equal(tx.sampled, true)
      assert.ok(tx.priority > 1)
      end()
    })
  })

  await t.test('should generate span events', (t) => {
    const { agent } = t.nr
    agent.config.span_events.enabled = true
    agent.config.distributed_tracing.enabled = true

    const transaction = new Transaction(agent)

    const trace = transaction.trace
    const child1 = (transaction.baseSegment = trace.add('test'))
    child1.start()
    const child2 = trace.add('nested', null, child1)
    child2.start()
    child1.end()
    child2.end()
    trace.root.end()
    transaction.end()

    const events = agent.spanEventAggregator.getEvents()
    const nested = events[0]
    const testSpan = events[1]
    assert.ok(nested.intrinsics)
    assert.ok(testSpan.intrinsics)

    assert.ok(nested.intrinsics.parentId)
    assert.equal(nested.intrinsics.parentId, testSpan.intrinsics.guid)
    assert.ok(nested.intrinsics.category)
    assert.equal(nested.intrinsics.category, 'generic')
    assert.ok(nested.intrinsics.priority)
    assert.equal(nested.intrinsics.priority, transaction.priority)
    assert.ok(nested.intrinsics.transactionId)
    assert.equal(nested.intrinsics.transactionId, transaction.id)
    assert.ok(nested.intrinsics.sampled)
    assert.equal(nested.intrinsics.sampled, transaction.sampled)
    assert.ok(nested.intrinsics.name)
    assert.equal(nested.intrinsics.name, 'nested')
    assert.ok(nested.intrinsics.traceId)
    assert.equal(nested.intrinsics.traceId, transaction.traceId)
    assert.ok(nested.intrinsics.timestamp)

    assert.equal(testSpan.intrinsics.parentId, null)
    assert.ok(testSpan.intrinsics['nr.entryPoint'])
    assert.ok(testSpan.intrinsics['nr.entryPoint'])
    assert.ok(testSpan.intrinsics.category)
    assert.equal(testSpan.intrinsics.category, 'generic')
    assert.ok(testSpan.intrinsics.priority)
    assert.equal(testSpan.intrinsics.priority, transaction.priority)
    assert.ok(testSpan.intrinsics.transactionId)
    assert.equal(testSpan.intrinsics.transactionId, transaction.id)
    assert.ok(testSpan.intrinsics.sampled)
    assert.equal(testSpan.intrinsics.sampled, transaction.sampled)
    assert.ok(testSpan.intrinsics.name)
    assert.equal(testSpan.intrinsics.name, 'test')
    assert.ok(testSpan.intrinsics.traceId)
    assert.equal(testSpan.intrinsics.traceId, transaction.traceId)
    assert.ok(testSpan.intrinsics.timestamp)
  })

  await t.test('should not generate span events on end if span_events is disabled', (t) => {
    const { agent } = t.nr
    agent.config.span_events.enabled = false
    agent.config.distributed_tracing.enabled = true

    const transaction = new Transaction(agent)

    const trace = transaction.trace
    const child1 = trace.add('test')
    child1.start()
    const child2 = trace.add('nested', null, child1)
    child2.start()
    child1.end()
    child2.end()
    trace.root.end()
    transaction.end()

    const events = agent.spanEventAggregator.getEvents()
    assert.equal(events.length, 0)
  })

  await t.test('should not generate span events on end if distributed_tracing is off', (t) => {
    const { agent } = t.nr
    agent.config.span_events.enabled = true
    agent.config.distributed_tracing.enabled = false

    const transaction = new Transaction(agent)

    const trace = transaction.trace
    const child1 = trace.add('test')
    child1.start()
    const child2 = trace.add('nested', null, child1)
    child2.start()
    child1.end()
    child2.end()
    trace.root.end()
    transaction.end()

    const events = agent.spanEventAggregator.getEvents()
    assert.equal(events.length, 0)
  })

  await t.test('parent.* attributes should be present on generated spans', (t) => {
    const { agent } = t.nr
    // Setup DT
    const encKey = 'gringletoes'
    agent.config.encoding_key = encKey
    agent.config.attributes.enabled = true
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = 111

    const dtInfo = {
      ty: 'App', // type
      ac: 111, // accountId
      ap: 222, // appId
      tx: 333, // transactionId
      tr: 444, // traceId
      pr: 1, // priority
      sa: true, // sampled
      // timestamp, if in the future, duration will always be 0
      ti: Date.now() + 10000
    }
    const dtPayload = new DTPayload(dtInfo)
    const headers = { [NEWRELIC_TRACE_HEADER]: dtPayload.httpSafe() }
    const transaction = new Transaction(agent)
    transaction.sampled = true

    // Get the parent attributes on the transaction
    transaction.acceptDistributedTraceHeaders('HTTP', headers)

    // Create at least one segment
    const trace = transaction.trace
    const child = (transaction.baseSegment = trace.add('test'))

    child.start()
    child.end()

    // This should add the parent attributes onto a child span event
    trace.generateSpanEvents()

    // Test that a child span event has the attributes
    const attrs = child.attributes.get(DESTINATIONS.SPAN_EVENT)
    assert.deepEqual(attrs, {
      'parent.type': 'App',
      'parent.app': 222,
      'parent.account': 111,
      'parent.transportType': 'HTTP',
      'parent.transportDuration': 0
    })
  })

  await t.test('should send host display name on transaction when set by user', (t) => {
    const { agent } = t.nr
    agent.config.attributes.enabled = true
    agent.config.process_host.display_name = 'test-value'

    const trace = new Trace(new Transaction(agent))

    assert.deepEqual(trace.attributes.get(DESTINATIONS.TRANS_TRACE), {
      'host.displayName': 'test-value'
    })
  })

  await t.test('should send host display name attribute on span', (t) => {
    const { agent } = t.nr
    agent.config.attributes.enabled = true
    agent.config.distributed_tracing.enabled = true
    agent.config.process_host.display_name = 'test-value'
    const transaction = new Transaction(agent)
    transaction.sampled = true

    const trace = transaction.trace

    // add a child segment
    const child = (transaction.baseSegment = trace.add('test'))

    child.start()
    child.end()

    trace.generateSpanEvents()

    assert.deepEqual(child.attributes.get(DESTINATIONS.SPAN_EVENT), {
      'host.displayName': 'test-value'
    })
  })

  await t.test('should not send host display name when not set by user', (t) => {
    const { agent } = t.nr
    const trace = new Trace(new Transaction(agent))

    assert.deepEqual(trace.attributes.get(DESTINATIONS.TRANS_TRACE), {})
  })
})

test('when serializing synchronously', async (t) => {
  t.beforeEach(async (ctx) => {
    const agent = helper.loadMockedAgent()
    const details = await makeTrace(agent)
    ctx.nr = {
      agent,
      details
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should produce a transaction trace in the expected format', async (t) => {
    const { details } = t.nr
    assert.equal(details.trace.segments.length, 3)
    const traceJSON = details.trace.generateJSONSync()
    assert.equal(details.trace.segments.length, 0)
    const reconstituted = await codecDecodeAsync(traceJSON[4])
    assert.deepEqual(traceJSON, details.expectedEncoding, 'full trace JSON')

    assert.deepEqual(reconstituted, details.rootNode, 'reconstituted trace segments')
  })

  await t.test('should send response time', (t) => {
    const { details } = t.nr
    details.transaction.getResponseTimeInMillis = () => {
      return 1234
    }

    const json = details.trace.generateJSONSync()
    assert.equal(json[1], 1234)
  })

  await t.test(
    'when `simple_compression` is `false`, should compress the segment arrays',
    async (t) => {
      const { details } = t.nr
      const json = details.trace.generateJSONSync()

      assert.match(json[4], /^[a-zA-Z0-9\+\/]+={0,2}$/, 'should be base64 encoded')

      const data = await codecDecodeAsync(json[4])
      assert.deepEqual(data, details.rootNode)
    }
  )

  await t.test(
    'when `simple_compression` is `true`, should not compress the segment arrays',
    (t) => {
      const { agent, details } = t.nr
      agent.config.simple_compression = true
      const json = details.trace.generateJSONSync()
      assert.deepEqual(json[4], details.rootNode)
    }
  )

  await t.test('when url_obfuscation is set, should obfuscate the URL', (t) => {
    const { agent, details } = t.nr
    agent.config.url_obfuscation = {
      enabled: true,
      regex: {
        pattern: '.*',
        replacement: '/***'
      }
    }

    const json = details.trace.generateJSONSync()
    assert.equal(json[3], '/***')
  })
})

test('when serializing asynchronously', async (t) => {
  t.beforeEach(async (ctx) => {
    const agent = helper.loadMockedAgent()
    const details = await makeTrace(agent)
    ctx.nr = {
      agent,
      details
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should produce a transaction trace in the expected format', async (t) => {
    const { details } = t.nr
    assert.equal(details.trace.segments.length, 3)
    const traceJSON = await details.trace.generateJSONAsync()
    assert.equal(details.trace.segments.length, 0)
    const reconstituted = await codecDecodeAsync(traceJSON[4])

    assert.deepEqual(traceJSON, details.expectedEncoding, 'full trace JSON')

    assert.deepEqual(reconstituted, details.rootNode, 'reconstituted trace segments')
  })

  await t.test('should send response time', async (t) => {
    const { details } = t.nr
    details.transaction.getResponseTimeInMillis = () => {
      return 1234
    }

    // not using `trace.generateJSONAsync` because
    // util.promisify only returns 1st arg in callback
    // see: https://github.com/nodejs/node/blob/master/lib/internal/util.js#L332
    return new Promise((resolve, reject) => {
      details.trace.generateJSON((err, json, trace) => {
        if (err) {
          reject(err)
        }

        assert.equal(json[1], 1234)
        assert.equal(trace, details.trace)
        resolve()
      })
    })
  })

  await t.test(
    'when `simple_compression` is `false`, should compress the segment arrays',
    async (t) => {
      const { details } = t.nr
      const json = await details.trace.generateJSONAsync()
      assert.match(json[4], /^[a-zA-Z0-9\+\/]+={0,2}$/, 'should be base64 encoded')

      const data = await codecDecodeAsync(json[4])
      assert.deepEqual(data, details.rootNode)
    }
  )

  await t.test(
    'when `simple_compression` is `true`, should not compress the segment arrays',
    async (t) => {
      const { agent, details } = t.nr
      agent.config.simple_compression = true
      const json = await details.trace.generateJSONAsync()
      assert.deepEqual(json[4], details.rootNode)
    }
  )
})

test('when inserting segments', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    const transaction = new Transaction(agent)
    const trace = transaction.trace
    ctx.nr = {
      agent,
      trace,
      transaction
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should allow child segments on a trace', (t) => {
    const { trace } = t.nr
    assert.doesNotThrow(() => {
      trace.add('Custom/Test17/Child1')
    })
  })

  await t.test('should return the segment', (t) => {
    const { trace } = t.nr
    let segment
    assert.doesNotThrow(() => {
      segment = trace.add('Custom/Test18/Child1')
    })
    assert.ok(segment instanceof Segment)
  })

  await t.test('should call a function associated with the segment', (t, end) => {
    const { trace, transaction } = t.nr
    const segment = trace.add('Custom/Test18/Child1', () => {
      end()
    })

    segment.end()
    transaction.end()
  })

  await t.test('should report total time', (t) => {
    const { trace } = t.nr
    trace.setDurationInMillis(40, 0)
    const child = trace.add('Custom/Test18/Child1')

    child.setDurationInMillis(27, 0)
    let seg = trace.add('UnitTest', null, child)
    seg.setDurationInMillis(9, 1)
    seg = trace.add('UnitTest1', null, child)
    seg.setDurationInMillis(13, 1)
    seg = trace.add('UnitTest2', null, child)
    seg.setDurationInMillis(9, 16)
    seg = trace.add('UnitTest2', null, child)
    seg.setDurationInMillis(14, 16)
    assert.equal(trace.getTotalTimeDurationInMillis(), 48)
  })

  await t.test('should report total time on branched traces', (t) => {
    const { trace } = t.nr
    trace.setDurationInMillis(40, 0)
    const child = trace.add('Custom/Test18/Child1', null, trace.root)
    child.setDurationInMillis(27, 0)
    const seg1 = trace.add('UnitTest', null, child)
    seg1.setDurationInMillis(9, 1)
    let seg = trace.add('UnitTest1', null, child)
    seg.setDurationInMillis(13, 1)
    seg = trace.add('UnitTest2', null, seg1)
    seg.setDurationInMillis(9, 16)
    seg = trace.add('UnitTest2', null, seg1)
    seg.setDurationInMillis(14, 16)
    assert.equal(trace.getTotalTimeDurationInMillis(), 48)
  })

  await t.test('should report the expected trees for trees with uncollected segments', (t) => {
    const { trace } = t.nr
    const expectedTrace = [
      0,
      40,
      'ROOT',
      { nr_exclusive_duration_millis: 10 },
      [
        [
          0,
          27,
          'Root',
          { nr_exclusive_duration_millis: 3 },
          [
            [
              1,
              10,
              'first',
              { nr_exclusive_duration_millis: 9 },
              [[16, 25, 'first-first', { nr_exclusive_duration_millis: 9 }, []]]
            ],
            [
              1,
              14,
              'second',
              { nr_exclusive_duration_millis: 13 },
              [
                [16, 25, 'second-first', { nr_exclusive_duration_millis: 9 }, []],
                [16, 25, 'second-second', { nr_exclusive_duration_millis: 9 }, []]
              ]
            ]
          ]
        ]
      ]
    ]

    trace.setDurationInMillis(40, 0)
    const child = trace.add('Root', null, trace.root)

    child.setDurationInMillis(27, 0)
    const seg1 = trace.add('first', null, child)

    seg1.setDurationInMillis(9, 1)
    const seg2 = trace.add('second', null, child)
    seg2.setDurationInMillis(13, 1)
    let seg = trace.add('first-first', null, seg1)
    seg.setDurationInMillis(9, 16)
    seg = trace.add('first-second', null, seg1)
    seg.setDurationInMillis(14, 16)
    seg._collect = false
    seg = trace.add('second-first', null, seg2)
    seg.setDurationInMillis(9, 16)
    seg = trace.add('second-second', null, seg2)
    seg.setDurationInMillis(9, 16)

    trace.end()

    assert.deepEqual(trace.toJSON(), expectedTrace)
  })

  await t.test('should report the expected trees for branched trees', (t) => {
    const { trace } = t.nr
    const expectedTrace = [
      0,
      40,
      'ROOT',
      { nr_exclusive_duration_millis: 10 },
      [
        [
          0,
          27,
          'Root',
          { nr_exclusive_duration_millis: 3 },
          [
            [
              1,
              10,
              'first',
              { nr_exclusive_duration_millis: 9 },
              [
                [16, 25, 'first-first', { nr_exclusive_duration_millis: 9 }, []],
                [16, 30, 'first-second', { nr_exclusive_duration_millis: 14 }, []]
              ]
            ],
            [
              1,
              14,
              'second',
              { nr_exclusive_duration_millis: 13 },
              [
                [16, 25, 'second-first', { nr_exclusive_duration_millis: 9 }, []],
                [16, 25, 'second-second', { nr_exclusive_duration_millis: 9 }, []]
              ]
            ]
          ]
        ]
      ]
    ]

    trace.setDurationInMillis(40, 0)
    const child = trace.add('Root', null, trace.root)

    child.setDurationInMillis(27, 0)
    const seg1 = trace.add('first', null, child)

    seg1.setDurationInMillis(9, 1)
    const seg2 = trace.add('second', null, child)
    seg2.setDurationInMillis(13, 1)
    let seg = trace.add('first-first', null, seg1)
    seg.setDurationInMillis(9, 16)
    seg = trace.add('first-second', null, seg1)
    seg.setDurationInMillis(14, 16)
    seg = trace.add('second-first', null, seg2)
    seg.setDurationInMillis(9, 16)
    seg = trace.add('second-second', null, seg2)
    seg.setDurationInMillis(9, 16)

    trace.end()

    assert.deepEqual(trace.toJSON(), expectedTrace)
  })

  await t.test('should measure exclusive time vs total time at each level of the graph', (t) => {
    const { trace } = t.nr
    const child = trace.add('Custom/Test18/Child1')

    trace.setDurationInMillis(42)
    child.setDurationInMillis(22, 0)

    assert.equal(trace.getExclusiveDurationInMillis(), 20)
  })

  await t.test('should accurately sum overlapping segments', (t) => {
    const { trace } = t.nr
    trace.setDurationInMillis(42)

    const now = Date.now()

    const child1 = trace.add('Custom/Test19/Child1')
    child1.setDurationInMillis(22, now)

    // add another child trace completely encompassed by the first
    const child2 = trace.add('Custom/Test19/Child2')
    child2.setDurationInMillis(5, now + 5)

    // add another that starts within the first range but that extends beyond
    const child3 = trace.add('Custom/Test19/Child3')

    child3.setDurationInMillis(22, now + 11)

    // add a final child that's entirely disjoint
    const child4 = trace.add('Custom/Test19/Child4')

    child4.setDurationInMillis(4, now + 35)

    assert.equal(trace.getExclusiveDurationInMillis(), 5)
  })

  await t.test('should accurately sum overlapping subtrees', (t) => {
    const { trace } = t.nr
    trace.setDurationInMillis(42)

    const now = Date.now()

    // create a long child on its own
    const child1 = trace.add('Custom/Test20/Child1')

    child1.setDurationInMillis(33, now)

    // add another, short child as a sibling
    const child2 = trace.add('Custom/Test20/Child2', null, child1)
    child2.setDurationInMillis(5, now)

    // add two disjoint children of the second segment encompassed by the first segment
    const child3 = trace.add('Custom/Test20/Child3', null, child2)
    child3.setDurationInMillis(11, now)

    const child4 = trace.add('Custom/Test20/Child3', null, child2)
    child4.setDurationInMillis(11, now + 16)

    assert.equal(trace.getExclusiveDurationInMillis(), 9)
    assert.equal(child4.getExclusiveDurationInMillis(trace), 11)
    assert.equal(child3.getExclusiveDurationInMillis(trace), 11)
    assert.equal(child2.getExclusiveDurationInMillis(trace), 0)
    assert.equal(child1.getExclusiveDurationInMillis(trace), 11)
  })

  await t.test('should accurately sum partially overlapping segments', (t) => {
    const { trace } = t.nr
    trace.setDurationInMillis(42)

    const now = Date.now()

    const child1 = trace.add('Custom/Test20/Child1')
    child1.setDurationInMillis(22, now)

    // add another child trace completely encompassed by the first
    const child2 = trace.add('Custom/Test20/Child2')
    child2.setDurationInMillis(5, now + 5)

    /* add another that starts simultaneously with the first range but
     * that extends beyond
     */
    const child3 = trace.add('Custom/Test20/Child3')
    child3.setDurationInMillis(33, now)

    assert.equal(trace.getExclusiveDurationInMillis(), 9)
  })

  await t.test('should accurately sum partially overlapping, open-ranged segments', (t) => {
    const { trace } = t.nr
    trace.setDurationInMillis(42)

    const now = Date.now()

    const child1 = trace.add('Custom/Test21/Child1')
    child1.setDurationInMillis(22, now)

    // add a range that starts at the exact end of the first
    const child2 = trace.add('Custom/Test21/Child2')
    child2.setDurationInMillis(11, now + 22)

    assert.equal(trace.getExclusiveDurationInMillis(), 9)
  })

  await t.test('should be limited to 900 children', (t) => {
    const { trace, transaction } = t.nr
    // They will be tagged as _collect = false after the limit runs out.
    for (let i = 0; i < 950; ++i) {
      const segment = trace.add(i.toString(), noop)
      if (i < 900) {
        assert.equal(segment._collect, true, `segment ${i} should be collected`)
      } else {
        assert.equal(segment._collect, false, `segment ${i} should not be collected`)
      }
    }

    assert.equal(trace.segments.length, 950)
    assert.equal(transaction._recorders.length, 950)
    trace.end()
    function noop() {}
  })

  await t.test('should not cause a stack overflow', { timeout: 30000 }, (t) => {
    const { trace } = t.nr
    for (let i = 0; i < 9000; ++i) {
      trace.add(`Child ${i}`)
    }

    assert.doesNotThrow(function () {
      trace.toJSON()
    })
  })
})

test('should set URI to null when request.uri attribute is excluded globally', async (t) => {
  const URL = '/test'

  const agent = helper.loadMockedAgent({
    attributes: {
      exclude: ['request.uri']
    }
  })

  t.after(() => {
    helper.unloadAgent(agent)
  })

  const transaction = new Transaction(agent)
  transaction.url = URL
  transaction.verb = 'GET'

  const trace = transaction.trace
  trace.generateJSON = util.promisify(trace.generateJSON)

  trace.end()

  const traceJSON = await trace.generateJSON()
  const { 3: requestUri } = traceJSON
  assert.ok(!requestUri)
})

test('should set URI to null when request.uri attribute is exluded from traces', async (t) => {
  const URL = '/test'

  const agent = helper.loadMockedAgent({
    transaction_tracer: {
      attributes: {
        exclude: ['request.uri']
      }
    }
  })

  t.after(() => {
    helper.unloadAgent(agent)
  })

  const transaction = new Transaction(agent)
  transaction.url = URL
  transaction.verb = 'GET'

  const trace = transaction.trace
  trace.generateJSON = util.promisify(trace.generateJSON)

  trace.end()

  const traceJSON = await trace.generateJSON()
  const { 3: requestUri } = traceJSON
  assert.ok(!requestUri)
})

test('should set URI to /Unknown when URL is not known/set on transaction', async (t) => {
  const agent = helper.loadMockedAgent()

  t.after(() => {
    helper.unloadAgent(agent)
  })

  const transaction = new Transaction(agent)
  const trace = transaction.trace
  trace.generateJSON = util.promisify(trace.generateJSON)

  trace.end()

  const traceJSON = await trace.generateJSON()
  const { 3: requestUri } = traceJSON
  assert.equal(requestUri, '/Unknown')
})

test('should obfuscate URI using regex when pattern is set', async (t) => {
  const URL = '/abc/123/def/456/ghi'
  const agent = helper.loadMockedAgent({
    url_obfuscation: {
      enabled: true,
      regex: {
        pattern: '/[0-9]+/',
        flags: 'g',
        replacement: '/***/'
      }
    }
  })

  t.after(() => {
    helper.unloadAgent(agent)
  })

  const transaction = new Transaction(agent)
  transaction.url = URL
  transaction.verb = 'GET'

  const trace = transaction.trace
  trace.generateJSON = util.promisify(trace.generateJSON)

  trace.end()

  const traceJSON = await trace.generateJSON()
  const { 3: requestUri } = traceJSON
  assert.equal(requestUri, '/abc/***/def/***/ghi')
})

test('infinite tracing', async (t) => {
  const VALID_HOST = 'infinite-tracing.test'
  const VALID_PORT = '443'

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      distributed_tracing: {
        enabled: true
      },
      span_events: {
        enabled: true
      },
      infinite_tracing: {
        trace_observer: {
          host: VALID_HOST,
          port: VALID_PORT
        }
      }
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should generate spans if infinite configured, transaction not sampled', (t) => {
    const { agent } = t.nr
    const spy = sinon.spy(agent.spanEventAggregator, 'addSegment')

    const transaction = new Transaction(agent)
    transaction.priority = 0
    transaction.sampled = false

    addTwoSegments(transaction)

    transaction.trace.generateSpanEvents()

    assert.equal(spy.callCount, 2)
  })

  await t.test(
    'should not generate spans if infinite not configured, transaction not sampled',
    (t) => {
      const { agent } = t.nr
      agent.config.infinite_tracing.trace_observer.host = ''

      const spy = sinon.spy(agent.spanEventAggregator, 'addSegment')

      const transaction = new Transaction(agent)
      transaction.priority = 0
      transaction.sampled = false

      addTwoSegments(transaction)

      transaction.trace.generateSpanEvents()

      assert.equal(spy.callCount, 0)
    }
  )
})

function addTwoSegments(transaction) {
  const trace = transaction.trace
  const child1 = (transaction.baseSegment = trace.add('test'))
  child1.start()
  const child2 = trace.add('nested', null, child1)
  child2.start()
  child1.end()
  child2.end()
  trace.root.end()
}

async function makeTrace(agent) {
  const DURATION = 33
  const URL = '/test?test=value'
  agent.config.attributes.enabled = true
  agent.config.attributes.include = ['request.parameters.*']
  agent.config.emit('attributes.include')

  const transaction = new Transaction(agent)
  transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'request.uri', URL)
  transaction.url = URL
  transaction.verb = 'GET'

  const trace = transaction.trace

  // promisifying `trace.generateJSON` so tests do not have to call done
  // and instead use async/await
  trace.generateJSONAsync = util.promisify(trace.generateJSON)
  const start = trace.root.timer.start
  assert.ok(start > 0, "root segment's start time")
  trace.setDurationInMillis(DURATION, 0)

  const web = trace.add(URL)
  transaction.baseSegment = web
  transaction.finalizeNameFromUri(URL, 200)
  // top-level element will share a duration with the quasi-ROOT node
  web.setDurationInMillis(DURATION, 0)

  const db = trace.add('Database/statement/AntiSQL/select/getSome', null, web)
  db.setDurationInMillis(14, 3)

  const memcache = trace.add('Datastore/operation/Memcache/lookup', null, web)
  memcache.setDurationInMillis(20, 8)

  transaction.timer.setDurationInMillis(DURATION)
  trace.end()

  /*
   * Segment data repeats the outermost data, nested, with the scope for the
   * outermost version having its scope always set to 'ROOT'. The null bits
   * are parameters, which are optional, and so far, unimplemented for Node.
   */
  const dbSegment = [
    3,
    17,
    'Database/statement/AntiSQL/select/getSome',
    { nr_exclusive_duration_millis: 14 },
    []
  ]
  const memcacheSegment = [
    8,
    28,
    'Datastore/operation/Memcache/lookup',
    { nr_exclusive_duration_millis: 20 },
    []
  ]

  const rootSegment = [
    0,
    DURATION,
    'ROOT',
    { nr_exclusive_duration_millis: 0 },
    [
      [
        0,
        DURATION,
        'WebTransaction/NormalizedUri/*',
        {
          'request.uri': '/test?test=value',
          'request.parameters.test': 'value',
          'nr_exclusive_duration_millis': 8
        },
        [dbSegment, memcacheSegment]
      ]
    ]
  ]
  const rootNode = [
    trace.root.timer.start / 1000,
    {},
    { nr_flatten_leading: false },
    rootSegment,
    {
      agentAttributes: {
        'request.uri': '/test?test=value',
        'request.parameters.test': 'value'
      },
      userAttributes: {},
      intrinsics: {}
    },
    [] // FIXME: parameter groups
  ]

  const encoded = await codecEncodeAsync(rootNode)
  return {
    transaction,
    trace,
    rootNode,
    expectedEncoding: [
      0,
      DURATION,
      'WebTransaction/NormalizedUri/*', // scope
      '/test', // URI path
      encoded, // compressed segment / segment data
      transaction.id, // guid
      null, // reserved, always NULL
      false, // FIXME: RUM2 session persistence, not worrying about it for now
      null, // FIXME: xraysessionid
      null // syntheticsResourceId
    ]
  }
}
