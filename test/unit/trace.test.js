/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const util = require('util')
const sinon = require('sinon')
const DESTINATIONS = require('../../lib/config/attribute-filter').DESTINATIONS
const helper = require('../lib/agent_helper')
const codec = require('../../lib/util/codec')
const codecEncodeAsync = util.promisify(codec.encode)
const codecDecodeAsync = util.promisify(codec.decode)
const Segment = require('../../lib/transaction/trace/segment')
const DTPayload = require('../../lib/transaction/dt-payload')
const Trace = require('../../lib/transaction/trace')
const Transaction = require('../../lib/transaction')

const NEWRELIC_TRACE_HEADER = 'newrelic'

tap.test('Trace', (t) => {
  t.autoend()
  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should always be bound to a transaction', (t) => {
    // fail
    t.throws(() => {
      return new Trace()
    }, /must be associated with a transaction/)

    // succeed
    const transaction = new Transaction(agent)
    const tt = new Trace(transaction)
    t.type(tt.transaction, Transaction)
    t.end()
  })

  t.test('should have the root of a Segment tree', (t) => {
    const tt = new Trace(new Transaction(agent))
    t.type(tt.root, Segment)
    t.end()
  })

  t.test('should be the primary interface for adding segments to a trace', (t) => {
    const transaction = new Transaction(agent)
    const trace = transaction.trace

    t.doesNotThrow(() => {
      trace.add('Custom/Test17/Child1')
    })
    t.end()
  })

  t.test('should have DT attributes on transaction end', (t) => {
    agent.config.distributed_tracing.enabled = true
    agent.config.primary_application_id = 'test'
    agent.config.account_id = 1
    helper.runInTransaction(agent, function (tx) {
      tx.end()
      const attributes = tx.trace.intrinsics
      t.equal(attributes.traceId, tx.traceId)
      t.equal(attributes.guid, tx.id)
      t.equal(attributes.priority, tx.priority)
      t.equal(attributes.sampled, tx.sampled)
      t.equal(attributes.parentId, undefined)
      t.equal(attributes.parentSpanId, undefined)
      t.equal(tx.sampled, true)
      t.ok(tx.priority > 1)
      t.end()
    })
  })

  t.test('should have DT parent attributes on payload accept', (t) => {
    agent.config.distributed_tracing.enabled = true
    agent.config.primary_application_id = 'test'
    agent.config.account_id = 1
    helper.runInTransaction(agent, function (tx) {
      const payload = tx._createDistributedTracePayload().text()
      tx.isDistributedTrace = null
      tx._acceptDistributedTracePayload(payload)
      tx.end()
      const attributes = tx.trace.intrinsics
      t.equal(attributes.traceId, tx.traceId)
      t.equal(attributes.guid, tx.id)
      t.equal(attributes.priority, tx.priority)
      t.equal(attributes.sampled, tx.sampled)
      t.equal(attributes['parent.type'], 'App')
      t.equal(attributes['parent.app'], agent.config.primary_application_id)
      t.equal(attributes['parent.account'], agent.config.account_id)
      t.equal(attributes.parentId, undefined)
      t.equal(attributes.parentSpanId, undefined)
      t.equal(tx.sampled, true)
      t.ok(tx.priority > 1)
      t.end()
    })
  })

  t.test('should generate span events', (t) => {
    agent.config.span_events.enabled = true
    agent.config.distributed_tracing.enabled = true

    const transaction = new Transaction(agent)

    const trace = transaction.trace
    const child1 = (transaction.baseSegment = trace.add('test'))
    child1.start()
    const child2 = child1.add('nested')
    child2.start()
    child1.end()
    child2.end()
    trace.root.end()
    transaction.end()
    trace.generateSpanEvents()

    const events = agent.spanEventAggregator.getEvents()
    const nested = events[0]
    const testSpan = events[1]
    t.hasProp(nested, 'intrinsics')
    t.hasProp(testSpan, 'intrinsics')

    t.hasProp(nested.intrinsics, 'parentId')
    t.equal(nested.intrinsics.parentId, testSpan.intrinsics.guid)
    t.hasProp(nested.intrinsics, 'category')
    t.equal(nested.intrinsics.category, 'generic')
    t.hasProp(nested.intrinsics, 'priority')
    t.equal(nested.intrinsics.priority, transaction.priority)
    t.hasProp(nested.intrinsics, 'transactionId')
    t.equal(nested.intrinsics.transactionId, transaction.id)
    t.hasProp(nested.intrinsics, 'sampled')
    t.equal(nested.intrinsics.sampled, transaction.sampled)
    t.hasProp(nested.intrinsics, 'name')
    t.equal(nested.intrinsics.name, 'nested')
    t.hasProp(nested.intrinsics, 'traceId')
    t.equal(nested.intrinsics.traceId, transaction.traceId)
    t.hasProp(nested.intrinsics, 'timestamp')

    t.hasProp(testSpan.intrinsics, 'parentId')
    t.equal(testSpan.intrinsics.parentId, null)
    t.hasProp(testSpan.intrinsics, 'nr.entryPoint')
    t.ok(testSpan.intrinsics['nr.entryPoint'])
    t.hasProp(testSpan.intrinsics, 'category')
    t.equal(testSpan.intrinsics.category, 'generic')
    t.hasProp(testSpan.intrinsics, 'priority')
    t.equal(testSpan.intrinsics.priority, transaction.priority)
    t.hasProp(testSpan.intrinsics, 'transactionId')
    t.equal(testSpan.intrinsics.transactionId, transaction.id)
    t.hasProp(testSpan.intrinsics, 'sampled')
    t.equal(testSpan.intrinsics.sampled, transaction.sampled)
    t.hasProp(testSpan.intrinsics, 'name')
    t.equal(testSpan.intrinsics.name, 'test')
    t.hasProp(testSpan.intrinsics, 'traceId')
    t.equal(testSpan.intrinsics.traceId, transaction.traceId)
    t.hasProp(testSpan.intrinsics, 'timestamp')
    t.end()
  })

  t.test('should not generate span events on end if span_events is disabled', (t) => {
    agent.config.span_events.enabled = false
    agent.config.distributed_tracing.enabled = true

    const transaction = new Transaction(agent)

    const trace = transaction.trace
    const child1 = trace.add('test')
    child1.start()
    const child2 = child1.add('nested')
    child2.start()
    child1.end()
    child2.end()
    trace.root.end()
    transaction.end()

    const events = agent.spanEventAggregator.getEvents()
    t.equal(events.length, 0)
    t.end()
  })

  t.test('should not generate span events on end if distributed_tracing is off', (t) => {
    agent.config.span_events.enabled = true
    agent.config.distributed_tracing.enabled = false

    const transaction = new Transaction(agent)

    const trace = transaction.trace
    const child1 = trace.add('test')
    child1.start()
    const child2 = child1.add('nested')
    child2.start()
    child1.end()
    child2.end()
    trace.root.end()
    transaction.end()

    const events = agent.spanEventAggregator.getEvents()
    t.equal(events.length, 0)
    t.end()
  })

  t.test('should not generate span events on end if transaction is not sampled', (t) => {
    agent.config.span_events.enabled = true
    agent.config.distributed_tracing.enabled = false

    const transaction = new Transaction(agent)

    const trace = transaction.trace
    const child1 = trace.add('test')
    child1.start()
    const child2 = child1.add('nested')
    child2.start()
    child1.end()
    child2.end()
    trace.root.end()

    transaction.priority = 0
    transaction.sampled = false
    transaction.end()

    const events = agent.spanEventAggregator.getEvents()
    t.equal(events.length, 0)
    t.end()
  })

  t.test('parent.* attributes should be present on generated spans', (t) => {
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
    const trace = new Trace(transaction)
    const child = (transaction.baseSegment = trace.add('test'))
    child.start()
    child.end()

    // This should add the parent attributes onto a child span event
    trace.generateSpanEvents()

    // Test that a child span event has the attributes
    const attrs = child.attributes.get(DESTINATIONS.SPAN_EVENT)
    t.same(attrs, {
      'parent.type': 'App',
      'parent.app': 222,
      'parent.account': 111,
      'parent.transportType': 'HTTP',
      'parent.transportDuration': 0
    })
    t.end()
  })

  t.test('should send host display name on transaction when set by user', (t) => {
    agent.config.attributes.enabled = true
    agent.config.process_host.display_name = 'test-value'

    const trace = new Trace(new Transaction(agent))

    t.same(trace.attributes.get(DESTINATIONS.TRANS_TRACE), {
      'host.displayName': 'test-value'
    })
    t.end()
  })

  t.test('should send host display name attribute on span', (t) => {
    agent.config.attributes.enabled = true
    agent.config.distributed_tracing.enabled = true
    agent.config.process_host.display_name = 'test-value'
    const transaction = new Transaction(agent)
    transaction.sampled = true

    const trace = new Trace(transaction)

    // add a child segment
    const child = (transaction.baseSegment = trace.add('test'))
    child.start()
    child.end()

    trace.generateSpanEvents()

    t.same(child.attributes.get(DESTINATIONS.SPAN_EVENT), {
      'host.displayName': 'test-value'
    })
    t.end()
  })

  t.test('should not send host display name when not set by user', (t) => {
    const trace = new Trace(new Transaction(agent))

    t.same(trace.attributes.get(DESTINATIONS.TRANS_TRACE), {})
    t.end()
  })
})

tap.test('when serializing synchronously', (t) => {
  t.autoend()
  let details

  let agent = null

  t.beforeEach(async () => {
    agent = helper.loadMockedAgent()
    details = await makeTrace(t, agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should produce a transaction trace in the expected format', async (t) => {
    const traceJSON = details.trace.generateJSONSync()
    const reconstituted = await codecDecodeAsync(traceJSON[4])
    t.same(traceJSON, details.expectedEncoding, 'full trace JSON')

    t.same(reconstituted, details.rootNode, 'reconstituted trace segments')
    t.end()
  })

  t.test('should send response time', (t) => {
    details.transaction.getResponseTimeInMillis = () => {
      return 1234
    }

    const json = details.trace.generateJSONSync()
    t.equal(json[1], 1234)
    t.end()
  })

  t.test('when `simple_compression` is `false`, should compress the segment arrays', async (t) => {
    const json = details.trace.generateJSONSync()

    t.match(json[4], /^[a-zA-Z0-9\+\/]+={0,2}$/, 'should be base64 encoded')

    const data = await codecDecodeAsync(json[4])
    t.same(data, details.rootNode)
    t.end()
  })

  t.test('when `simple_compression` is `true`, should not compress the segment arrays', (t) => {
    agent.config.simple_compression = true
    const json = details.trace.generateJSONSync()
    t.same(json[4], details.rootNode)
    t.end()
  })

  t.test('when url_obfuscation is set, should obfuscate the URL', (t) => {
    agent.config.url_obfuscation = {
      enabled: true,
      regex: {
        pattern: '.*',
        replacement: '/***'
      }
    }

    const json = details.trace.generateJSONSync()
    t.equal(json[3], '/***')
    t.end()
  })
})

tap.test('when serializing asynchronously', (t) => {
  t.autoend()

  let details

  let agent = null

  t.beforeEach(async () => {
    agent = helper.loadMockedAgent()
    details = await makeTrace(t, agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should produce a transaction trace in the expected format', async (t) => {
    const traceJSON = await details.trace.generateJSONAsync()
    const reconstituted = await codecDecodeAsync(traceJSON[4])

    t.same(traceJSON, details.expectedEncoding, 'full trace JSON')

    t.same(reconstituted, details.rootNode, 'reconstituted trace segments')
    t.end()
  })

  t.test('should send response time', (t) => {
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

        t.equal(json[1], 1234)
        t.equal(trace, details.trace)
        resolve()
      })
    })
  })

  t.test('when `simple_compression` is `false`, should compress the segment arrays', async (t) => {
    const json = await details.trace.generateJSONAsync()
    t.match(json[4], /^[a-zA-Z0-9\+\/]+={0,2}$/, 'should be base64 encoded')

    const data = await codecDecodeAsync(json[4])
    t.same(data, details.rootNode)
    t.end()
  })

  t.test(
    'when `simple_compression` is `true`, should not compress the segment arrays',
    async (t) => {
      agent.config.simple_compression = true
      const json = await details.trace.generateJSONAsync()
      t.same(json[4], details.rootNode)
      t.end()
    }
  )
})

tap.test('when inserting segments', (t) => {
  t.autoend()
  let agent
  let trace = null
  let transaction = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    transaction = new Transaction(agent)
    trace = transaction.trace
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should allow child segments on a trace', (t) => {
    t.doesNotThrow(() => {
      trace.add('Custom/Test17/Child1')
    })
    t.end()
  })

  t.test('should return the segment', (t) => {
    let segment
    t.doesNotThrow(() => {
      segment = trace.add('Custom/Test18/Child1')
    })
    t.type(segment, Segment)
    t.end()
  })

  t.test('should call a function associated with the segment', (t) => {
    const segment = trace.add('Custom/Test18/Child1', () => {
      t.end()
    })

    segment.end()
    transaction.end()
  })

  t.test('should report total time', (t) => {
    trace.setDurationInMillis(40, 0)
    const child = trace.add('Custom/Test18/Child1')
    child.setDurationInMillis(27, 0)
    let seg = child.add('UnitTest')
    seg.setDurationInMillis(9, 1)
    seg = child.add('UnitTest1')
    seg.setDurationInMillis(13, 1)
    seg = child.add('UnitTest2')
    seg.setDurationInMillis(9, 16)
    seg = child.add('UnitTest2')
    seg.setDurationInMillis(14, 16)
    t.equal(trace.getTotalTimeDurationInMillis(), 48)
    t.end()
  })

  t.test('should report total time on branched traces', (t) => {
    trace.setDurationInMillis(40, 0)
    const child = trace.add('Custom/Test18/Child1')
    child.setDurationInMillis(27, 0)
    const seg1 = child.add('UnitTest')
    seg1.setDurationInMillis(9, 1)
    let seg = child.add('UnitTest1')
    seg.setDurationInMillis(13, 1)
    seg = seg1.add('UnitTest2')
    seg.setDurationInMillis(9, 16)
    seg = seg1.add('UnitTest2')
    seg.setDurationInMillis(14, 16)
    t.equal(trace.getTotalTimeDurationInMillis(), 48)
    t.end()
  })

  t.test('should report the expected trees for trees with uncollected segments', (t) => {
    const expectedTrace = [
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

    trace.setDurationInMillis(40, 0)
    const child = trace.add('Root')
    child.setDurationInMillis(27, 0)
    const seg1 = child.add('first')
    seg1.setDurationInMillis(9, 1)
    const seg2 = child.add('second')
    seg2.setDurationInMillis(13, 1)
    let seg = seg1.add('first-first')
    seg.setDurationInMillis(9, 16)
    seg = seg1.add('first-second')
    seg.setDurationInMillis(14, 16)
    seg._collect = false
    seg = seg2.add('second-first')
    seg.setDurationInMillis(9, 16)
    seg = seg2.add('second-second')
    seg.setDurationInMillis(9, 16)

    trace.end()

    t.same(child.toJSON(), expectedTrace)
    t.end()
  })

  t.test('should report the expected trees for branched trees', (t) => {
    const expectedTrace = [
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
    trace.setDurationInMillis(40, 0)
    const child = trace.add('Root')
    child.setDurationInMillis(27, 0)
    const seg1 = child.add('first')
    seg1.setDurationInMillis(9, 1)
    const seg2 = child.add('second')
    seg2.setDurationInMillis(13, 1)
    let seg = seg1.add('first-first')
    seg.setDurationInMillis(9, 16)
    seg = seg1.add('first-second')
    seg.setDurationInMillis(14, 16)
    seg = seg2.add('second-first')
    seg.setDurationInMillis(9, 16)
    seg = seg2.add('second-second')
    seg.setDurationInMillis(9, 16)

    trace.end()

    t.same(child.toJSON(), expectedTrace)
    t.end()
  })

  t.test('should measure exclusive time vs total time at each level of the graph', (t) => {
    const child = trace.add('Custom/Test18/Child1')

    trace.setDurationInMillis(42)
    child.setDurationInMillis(22, 0)

    t.equal(trace.getExclusiveDurationInMillis(), 20)
    t.end()
  })

  t.test('should accurately sum overlapping segments', (t) => {
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

    t.equal(trace.getExclusiveDurationInMillis(), 5)
    t.end()
  })

  t.test('should accurately sum overlapping subtrees', (t) => {
    trace.setDurationInMillis(42)

    const now = Date.now()

    // create a long child on its own
    const child1 = trace.add('Custom/Test20/Child1')
    child1.setDurationInMillis(33, now)

    // add another, short child as a sibling
    const child2 = child1.add('Custom/Test20/Child2')
    child2.setDurationInMillis(5, now)

    // add two disjoint children of the second segment encompassed by the first segment
    const child3 = child2.add('Custom/Test20/Child3')
    child3.setDurationInMillis(11, now)

    const child4 = child2.add('Custom/Test20/Child3')
    child4.setDurationInMillis(11, now + 16)

    t.equal(trace.getExclusiveDurationInMillis(), 9)
    t.equal(child4.getExclusiveDurationInMillis(), 11)
    t.equal(child3.getExclusiveDurationInMillis(), 11)
    t.equal(child2.getExclusiveDurationInMillis(), 0)
    t.equal(child1.getExclusiveDurationInMillis(), 11)
    t.end()
  })

  t.test('should accurately sum partially overlapping segments', (t) => {
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

    t.equal(trace.getExclusiveDurationInMillis(), 9)
    t.end()
  })

  t.test('should accurately sum partially overlapping, open-ranged segments', (t) => {
    trace.setDurationInMillis(42)

    const now = Date.now()

    const child1 = trace.add('Custom/Test21/Child1')
    child1.setDurationInMillis(22, now)

    // add a range that starts at the exact end of the first
    const child2 = trace.add('Custom/Test21/Child2')
    child2.setDurationInMillis(11, now + 22)

    t.equal(trace.getExclusiveDurationInMillis(), 9)
    t.end()
  })

  t.test('should be limited to 900 children', (t) => {
    // They will be tagged as _collect = false after the limit runs out.
    for (let i = 0; i < 950; ++i) {
      const segment = trace.add(i.toString(), noop)
      if (i < 900) {
        t.equal(segment._collect, true, `segment ${i} should be collected`)
      } else {
        t.equal(segment._collect, false, `segment ${i} should not be collected`)
      }
    }

    t.equal(trace.root.children.length, 950)
    t.equal(transaction._recorders.length, 950)
    trace.segmentCount = 0
    trace.root.children = []
    trace.recorders = []

    function noop() {}
    t.end()
  })
})

tap.test('should set URI to null when request.uri attribute is excluded globally', async (t) => {
  const URL = '/test'

  const agent = helper.loadMockedAgent({
    attributes: {
      exclude: ['request.uri']
    }
  })

  t.teardown(() => {
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
  t.notOk(requestUri)
  t.end()
})

tap.test('should set URI to null when request.uri attribute is exluded from traces', async (t) => {
  const URL = '/test'

  const agent = helper.loadMockedAgent({
    transaction_tracer: {
      attributes: {
        exclude: ['request.uri']
      }
    }
  })

  t.teardown(() => {
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
  t.notOk(requestUri)
  t.end()
})

tap.test('should set URI to /Unknown when URL is not known/set on transaction', async (t) => {
  const agent = helper.loadMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  const transaction = new Transaction(agent)
  const trace = transaction.trace
  trace.generateJSON = util.promisify(trace.generateJSON)

  trace.end()

  const traceJSON = await trace.generateJSON()
  const { 3: requestUri } = traceJSON
  t.equal(requestUri, '/Unknown')
  t.end()
})

tap.test('should obfuscate URI using regex when pattern is set', async (t) => {
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

  t.teardown(() => {
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
  t.equal(requestUri, '/abc/***/def/***/ghi')
  t.end()
})

async function makeTrace(t, agent) {
  const DURATION = 33
  const URL = '/test?test=value'
  agent.config.attributes.enabled = true
  agent.config.attributes.include = ['request.parameters.*']
  agent.config.emit('attributes.include')

  const transaction = new Transaction(agent)
  transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'request.uri', URL)
  transaction.url = URL
  transaction.verb = 'GET'

  transaction.timer.setDurationInMillis(DURATION)

  const trace = transaction.trace

  // promisifying `trace.generateJSON` so tests do not have to call done
  // and instead use async/await
  trace.generateJSONAsync = util.promisify(trace.generateJSON)
  const start = trace.root.timer.start
  t.ok(start > 0, "root segment's start time")
  trace.setDurationInMillis(DURATION, 0)

  const web = trace.root.add(URL)
  transaction.baseSegment = web
  transaction.finalizeNameFromUri(URL, 200)
  // top-level element will share a duration with the quasi-ROOT node
  web.setDurationInMillis(DURATION, 0)

  const db = web.add('Database/statement/AntiSQL/select/getSome')
  db.setDurationInMillis(14, 3)

  const memcache = web.add('Datastore/operation/Memcache/lookup')
  memcache.setDurationInMillis(20, 8)

  trace.end()

  /*
   * Segment data repeats the outermost data, nested, with the scope for the
   * outermost version having its scope always set to 'ROOT'. The null bits
   * are parameters, which are optional, and so far, unimplemented for Node.
   */
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
        [
          // TODO: ensure that the ordering is correct WRT start time
          db.toJSON(),
          memcache.toJSON()
        ]
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
    rootSegment,
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

tap.test('infinite tracing', (t) => {
  t.autoend()

  const VALID_HOST = 'infinite-tracing.test'
  const VALID_PORT = '443'

  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent({
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

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should generate spans if infinite configured, transaction not sampled', (t) => {
    const spy = sinon.spy(agent.spanEventAggregator, 'addSegment')

    const transaction = new Transaction(agent)
    transaction.priority = 0
    transaction.sampled = false

    addTwoSegments(transaction)

    transaction.trace.generateSpanEvents()

    t.equal(spy.callCount, 2)

    t.end()
  })

  t.test('should not generate spans if infinite not configured, transaction not sampled', (t) => {
    agent.config.infinite_tracing.trace_observer.host = ''

    const spy = sinon.spy(agent.spanEventAggregator, 'addSegment')

    const transaction = new Transaction(agent)
    transaction.priority = 0
    transaction.sampled = false

    addTwoSegments(transaction)

    transaction.trace.generateSpanEvents()

    t.equal(spy.callCount, 0)

    t.end()
  })
})

function addTwoSegments(transaction) {
  const trace = transaction.trace
  const child1 = (transaction.baseSegment = trace.add('test'))
  child1.start()
  const child2 = child1.add('nested')
  child2.start()
  child1.end()
  child2.end()
  trace.root.end()
}
