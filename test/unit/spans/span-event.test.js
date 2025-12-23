/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const { describe, test } = require('node:test')
const DatastoreShim = require('../../../lib/shim/datastore-shim')
const helper = require('../../lib/agent_helper')
const http = require('http')
const SpanEvent = require('../../../lib/spans/span-event')
const DatastoreParameters = require('../../../lib/shim/specs/params/datastore')
const { QuerySpec } = require('../../../lib/shim/specs')
const nock = require('nock')

test('#constructor() should construct an empty span event', () => {
  const attrs = {}
  const span = new SpanEvent(attrs)

  assert.ok(span)
  assert.ok(span instanceof SpanEvent)
  assert.equal(span.attributes, attrs)

  assert.ok(span.intrinsics)
  assert.equal(span.intrinsics.type, 'Span')
  assert.equal(span.intrinsics.category, SpanEvent.CATEGORIES.GENERIC)

  const emptyProps = [
    'traceId',
    'guid',
    'parentId',
    'transactionId',
    'sampled',
    'priority',
    'name',
    'timestamp',
    'duration'
  ]
  emptyProps.forEach((prop) => {
    assert.equal(span.intrinsics[prop], null)
  })
})

describe('createSpan()', () => {
  test('adds empty spanLinks if none present', () => {
    const span = SpanEvent.createSpan({
      segment: {},
      attributes: {},
      customAttributes: {}
    })
    assert.equal(Array.isArray(span.spanLinks), true)
    assert.equal(span.spanLinks.length, 0)
  })

  test('propagates spanLinks', () => {
    const segment = {
      spanLinks: [{ id: 1 }]
    }
    const span = SpanEvent.createSpan({
      segment,
      attributes: {},
      customAttributes: {}
    })
    assert.deepStrictEqual(span.spanLinks, [{ id: 1 }])
  })

  test('adds empty timedEvents (otel span events) if none present', () => {
    const span = SpanEvent.createSpan({
      segment: {},
      attributes: {},
      customAttributes: {}
    })
    assert.equal(Array.isArray(span.timedEvents), true)
    assert.equal(span.timedEvents.length, 0)
  })

  test('propagates timedEvents (otel span events)', () => {
    const segment = {
      timedEvents: [{ name: 'custom.otel.span-event', attributes: { 'event.type': 'custom' } }]
    }
    const span = SpanEvent.createSpan({
      segment,
      attributes: {},
      customAttributes: {}
    })
    assert.deepStrictEqual(span.timedEvents, [{ name: 'custom.otel.span-event', attributes: { 'event.type': 'custom' } }])
  })
})

test('fromSegment()', async (t) => {
  t.beforeEach((ctx) => {
    nock.disableNetConnect()
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
  })

  t.afterEach((ctx) => {
    nock.enableNetConnect()
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should create a generic span with a random segment', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      transaction.sampled = true
      transaction.priority = 42

      const segment = agent.tracer.createSegment({
        name: 'genericSegment',
        transaction,
        parent: transaction.trace.root
      })
      segment.setDurationInMillis(300)
      segment.addSpanAttribute('SpiderSpan', 'web')
      segment.addSpanAttribute('host', 'my-host')
      segment.addSpanAttribute('port', 222)

      const spanContext = segment.getSpanContext()
      spanContext.addCustomAttribute('Span Lee', 'no prize')

      const span = SpanEvent.fromSegment({ segment, transaction, parentId: 'parent', isEntry: true })

      // Should have all the normal properties.
      assert.ok(span)
      assert.ok(span instanceof SpanEvent)

      assert.ok(span.intrinsics)
      assert.equal(span.intrinsics.type, 'Span')
      assert.equal(span.intrinsics.category, SpanEvent.CATEGORIES.GENERIC)
      assert.equal(span.intrinsics['nr.entryPoint'], true)

      assert.equal(span.intrinsics.traceId, transaction.traceId)
      assert.equal(span.intrinsics.guid, segment.id)
      assert.equal(span.intrinsics.parentId, 'parent')
      assert.equal(span.parentId, 'parent')
      assert.equal(span.intrinsics.transactionId, transaction.id)
      assert.equal(span.intrinsics.sampled, true)
      assert.equal(span.intrinsics.priority, 42)
      assert.equal(span.intrinsics.name, 'genericSegment')
      assert.equal(span.intrinsics.timestamp, segment.timer.start)

      assert.equal(span.intrinsics.duration, 0.3)

      // Generic should not have 'span.kind' or 'component'
      assert.equal(span.intrinsics['span.kind'], 'internal')
      assert.equal(span.intrinsics.component, null)

      assert.ok(span.customAttributes)
      const customAttributes = span.customAttributes

      assert.ok(customAttributes['Span Lee'])

      assert.ok(span.attributes)
      const attributes = span.attributes

      const hasOwnAttribute = Object.hasOwnProperty.bind(attributes)

      assert.ok(hasOwnAttribute('SpiderSpan'), 'Should have attribute added through segment')
      assert.equal(attributes['server.address'], 'my-host')
      assert.equal(attributes['server.port'], 222)

      // Should have no http properties.
      assert.ok(!hasOwnAttribute('externalLibrary'))
      assert.ok(!hasOwnAttribute('externalUri'))
      assert.ok(!hasOwnAttribute('externalProcedure'))

      // Should have no datastore properties.
      assert.ok(!hasOwnAttribute('db.statement'))
      assert.ok(!hasOwnAttribute('db.instance'))
      assert.ok(!hasOwnAttribute('db.system'))
      assert.ok(!hasOwnAttribute('peer.hostname'))
      assert.ok(!hasOwnAttribute('peer.address'))
      end()
    })
  })

  await t.test('should create an http span with a external segment', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      transaction.sampled = true
      transaction.priority = 42
      nock('http://example.com').get('/?foo=bar').reply(200)

      http.get('http://example.com?foo=bar', (res) => {
        res.resume()
        res.on('end', () => {
          const tx = agent.tracer.getTransaction()
          const [segment] = tx.trace.getChildren(tx.trace.root.id)
          const span = SpanEvent.fromSegment({ segment, transaction, parentId: 'parent' })

          // Should have all the normal properties.
          assert.ok(span)
          assert.ok(span instanceof SpanEvent)
          assert.ok(span instanceof SpanEvent.HttpSpanEvent)

          assert.ok(span.intrinsics)
          assert.equal(span.intrinsics.type, 'Span')
          assert.equal(span.intrinsics.category, SpanEvent.CATEGORIES.HTTP)

          assert.equal(span.intrinsics.traceId, transaction.traceId)
          assert.equal(span.intrinsics.guid, segment.id)
          assert.equal(span.intrinsics.parentId, 'parent')
          assert.equal(span.intrinsics.transactionId, transaction.id)
          assert.equal(span.intrinsics.sampled, true)
          assert.equal(span.intrinsics.priority, 42)

          assert.equal(span.intrinsics.name, 'External/example.com/')
          assert.equal(span.intrinsics.timestamp, segment.timer.start)

          assert.ok(span.intrinsics.duration > 0 && span.intrinsics.duration <= 2)

          // Should have type-specific intrinsics
          assert.equal(span.intrinsics.component, 'http')
          assert.equal(span.intrinsics['span.kind'], 'client')

          assert.ok(span.attributes)
          const attributes = span.attributes

          // Should have (most) http properties.
          assert.equal(attributes['http.url'], 'http://example.com/')
          assert.equal(attributes['server.address'], 'example.com')
          assert.equal(attributes['server.port'], 80)
          assert.ok(attributes['http.method'])
          assert.ok(attributes['http.request.method'])
          assert.equal(attributes['http.statusCode'], 200)

          // should nullify mapped properties
          assert.ok(!attributes.library)
          assert.ok(!attributes.url)
          assert.ok(!attributes.hostname)
          assert.ok(!attributes.port)
          assert.ok(!attributes.procedure)

          // Should have no datastore properties.
          const hasOwnAttribute = Object.hasOwnProperty.bind(attributes)
          assert.ok(!hasOwnAttribute('db.statement'))
          assert.ok(!hasOwnAttribute('db.instance'))
          assert.ok(!hasOwnAttribute('db.system'))
          assert.ok(!hasOwnAttribute('peer.hostname'))
          assert.ok(!hasOwnAttribute('peer.address'))

          end()
        })
      })
    })
  })

  await t.test('should create a datastore span with a datastore segment', (t, end) => {
    const { agent } = t.nr
    agent.config.transaction_tracer.record_sql = 'raw'

    const shim = new DatastoreShim(agent, 'test-data-store')
    shim.setDatastore('TestStore')

    const dsConn = { myDbOp: (query, cb) => setTimeout(cb, 50) }
    let longQuery = ''
    while (Buffer.byteLength(longQuery, 'utf8') < 2001) {
      longQuery += 'a'
    }
    shim.recordQuery(
      dsConn,
      'myDbOp',
      new QuerySpec({
        callback: shim.LAST,
        query: shim.FIRST,
        parameters: new DatastoreParameters({
          host: 'my-db-host',
          port_path_or_id: '/path/to/db.sock',
          database_name: 'my-database',
          collection: 'my-collection'
        })
      })
    )

    shim.setParser((query) => {
      return {
        collection: 'test',
        operation: 'test',
        query
      }
    })

    helper.runInTransaction(agent, (transaction) => {
      transaction.sampled = true
      transaction.priority = 42

      dsConn.myDbOp(longQuery, () => {
        transaction.end()
        const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
        const span = SpanEvent.fromSegment({ segment, transaction, parentId: 'parent' })

        // Should have all the normal properties.
        assert.ok(span)
        assert.ok(span instanceof SpanEvent)
        assert.ok(span instanceof SpanEvent.DatastoreSpanEvent)

        assert.ok(span.intrinsics)
        assert.equal(span.intrinsics.type, 'Span')
        assert.equal(span.intrinsics.category, SpanEvent.CATEGORIES.DATASTORE)

        assert.equal(span.intrinsics.traceId, transaction.traceId)
        assert.equal(span.intrinsics.guid, segment.id)
        assert.equal(span.intrinsics.parentId, 'parent')
        assert.equal(span.intrinsics.transactionId, transaction.id)
        assert.equal(span.intrinsics.sampled, true)
        assert.equal(span.intrinsics.priority, 42)

        assert.equal(span.intrinsics.name, 'Datastore/statement/TestStore/test/test')
        assert.equal(span.intrinsics.timestamp, segment.timer.start)

        assert.ok(span.intrinsics.duration >= 0.03 && span.intrinsics.duration <= 0.7)

        // Should have (most) type-specific intrinsics
        assert.equal(span.intrinsics.component, 'TestStore')
        assert.equal(span.intrinsics['span.kind'], 'client')

        assert.ok(span.attributes)
        const attributes = span.attributes

        // Should have not http properties.
        const hasOwnAttribute = Object.hasOwnProperty.bind(attributes)
        assert.ok(!hasOwnAttribute('http.url'))
        assert.ok(!hasOwnAttribute('http.method'))
        assert.ok(!hasOwnAttribute('http.request.method'))

        // Should have (most) datastore properties.
        assert.ok(attributes['db.instance'])
        assert.equal(attributes['db.collection'], 'my-collection')
        assert.equal(attributes['peer.hostname'], 'my-db-host')
        assert.equal(attributes['peer.address'], 'my-db-host:/path/to/db.sock')
        assert.equal(attributes['db.system'], 'TestStore') // same as intrinsics.component
        assert.equal(attributes['server.address'], 'my-db-host')
        assert.equal(attributes['server.port'], '/path/to/db.sock')

        const statement = attributes['db.statement']
        assert.ok(statement)

        // Testing query truncation
        assert.ok(statement.endsWith('...'))
        assert.equal(Buffer.byteLength(statement, 'utf8'), 2000)

        end()
      })
    })
  })

  await t.test('should serialize intrinsics to proper format with toJSON method', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      transaction.priority = 42
      transaction.sampled = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()
        const span = SpanEvent.fromSegment({ segment, transaction, parentId: 'parent' })

        const serializedSpan = span.toJSON()
        const [intrinsics] = serializedSpan

        assert.equal(intrinsics.type, 'Span')
        assert.equal(intrinsics.traceId, transaction.traceId)
        assert.equal(intrinsics.guid, segment.id)
        assert.equal(intrinsics.parentId, 'parent')
        assert.equal(intrinsics.transactionId, transaction.id)
        assert.equal(intrinsics.priority, 42)
        assert.ok(intrinsics.name)
        assert.equal(intrinsics.category, 'generic')
        assert.ok(intrinsics.timestamp)
        assert.ok(intrinsics.duration)

        end()
      }, 10)
    })
  })

  await t.test('should populate intrinsics from span context', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      transaction.priority = 42
      transaction.sampled = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()
        const spanContext = segment.getSpanContext()
        spanContext.addIntrinsicAttribute('intrinsic.1', 1)
        spanContext.addIntrinsicAttribute('intrinsic.2', 2)

        const span = SpanEvent.fromSegment({ segment, transaction, parentId: 'parent' })

        const serializedSpan = span.toJSON()
        const [intrinsics] = serializedSpan

        assert.equal(intrinsics['intrinsic.1'], 1)
        assert.equal(intrinsics['intrinsic.2'], 2)

        end()
      }, 10)
    })
  })

  await t.test('should handle truncated http spans', (t, end) => {
    const { agent } = t.nr
    nock('http://www.example.com').get('/path?foo=bar').reply(200)
    helper.runInTransaction(agent, (transaction) => {
      http.get('http://www.example.com/path?foo=bar', (res) => {
        transaction.end() // prematurely end to truncate

        res.resume()
        res.on('end', () => {
          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          assert.ok(segment.name.startsWith('Truncated'))

          const span = SpanEvent.fromSegment({ segment, transaction })
          assert.ok(span)
          assert.ok(span instanceof SpanEvent)
          assert.ok(span instanceof SpanEvent.HttpSpanEvent)

          end()
        })
      })
    })
  })

  await t.test('should handle truncated datastore spans', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      const segment = transaction.trace.add('Datastore/operation/something')
      transaction.end() // end before segment to trigger truncate

      assert.ok(segment.name.startsWith('Truncated'))

      const span = SpanEvent.fromSegment({ segment, transaction })
      assert.ok(span)
      assert.ok(span instanceof SpanEvent)
      assert.ok(span instanceof SpanEvent.DatastoreSpanEvent)

      end()
    })
  })

  await t.test('should not record partial granularity metrics when not part of partialTrace', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      const segment = transaction.trace.add('Datastore/operation/Redis/SET')
      const span = SpanEvent.fromSegment({ segment, transaction })
      assert.ok(span)
      end()
    })
  })
})

test('span.id maps to span.intrinsics.guid', (t) => {
  const span = new SpanEvent({}, {})
  span.addIntrinsicAttribute('guid', '123455')
  assert.equal(span.id, span.intrinsics.guid)
})

test('span.parentId maps to span.intrinsics.parentId', (t) => {
  const span = new SpanEvent({}, {})
  span.addIntrinsicAttribute('parentId', '123455')
  assert.equal(span.parentId, span.intrinsics.parentId)
})

const testSpans = [
  { name: 'Datastore/operation/test', isExit: true, isLlm: false },
  { name: 'External/example.com/test', isExit: true, isLlm: false },
  { name: 'MessageBroker/Produce/Named/test', isExit: true, isLlm: false },
  { name: 'UnitTest', isExit: false, isLlm: false },
  { name: 'Llm/Foobar', isExit: false, isLlm: true }
]
for (const testSpan of testSpans) {
  test(`${testSpan.name} should return ${testSpan.isExit} for 'isExitSpan'`, (t) => {
    const span = new SpanEvent({}, {})
    span.addIntrinsicAttribute('name', testSpan.name)
    assert.equal(span.isExitSpan, testSpan.isExit)
    // should cache result if ran more than once
    span.addIntrinsicAttribute('name', 'updatedName')
    assert.equal(span.isExitSpan, testSpan.isExit)
  })

  test(`${testSpan.name} should return ${testSpan.isLlm} for 'isLlmSpan'`, (t) => {
    const span = new SpanEvent({}, {})
    span.addIntrinsicAttribute('name', testSpan.name)
    assert.equal(span.isLlmSpan, testSpan.isLlm)
    // should cache result if ran more than once
    span.addIntrinsicAttribute('name', 'updatedName')
    assert.equal(span.isLlmSpan, testSpan.isLlm)
  })
}

describe('entityRelationshipAttrs', () => {
  test('should cache the result after first access', () => {
    const span = new SpanEvent({ 'db.system': 'redis' }, {})

    assert.deepEqual(span.entityRelationshipAttrs, { 'db.system': 'redis' })
    assert.equal(span.hasEntityRelationshipAttrs, true)
    // modified attributes should not affect cached result
    delete span.attributes['db.system']

    assert.equal(span.hasEntityRelationshipAttrs, true)
    assert.deepEqual(span.entityRelationshipAttrs, { 'db.system': 'redis' })
  })

  test('should return false when no entity relationship attributes are present', () => {
    const span = new SpanEvent({ attr: 'value' }, {})
    assert.equal(span.hasEntityRelationshipAttrs, false)
    assert.deepEqual(span.entityRelationshipAttrs, {})
  })

  test('should return false when attributes object is empty', () => {
    const span = new SpanEvent({}, {})
    assert.equal(span.hasEntityRelationshipAttrs, false)
    assert.deepEqual(span.entityRelationshipAttrs, {})
  })
})

describe('errorAttrs', () => {
  test('should cache the result after first access', () => {
    const span = new SpanEvent({ 'error.class': 'TestError' }, {})

    assert.deepEqual(span.errorAttrs, { 'error.class': 'TestError' })
    assert.equal(span.hasErrorAttrs, true)
    // modified attributes should not affect cached result
    delete span.attributes['error.class']

    assert.deepEqual(span.errorAttrs, { 'error.class': 'TestError' })
    assert.equal(span.hasErrorAttrs, true)
  })

  test('should return false when no entity relationship attributes are present', () => {
    const span = new SpanEvent({ attr: 'value' }, {})
    assert.equal(span.hasErrorAttrs, false)
    assert.deepEqual(span.errorAttrs, {})
  })

  test('should return false when attributes object is empty', () => {
    const span = new SpanEvent({}, {})
    assert.equal(span.hasErrorAttrs, false)
    assert.deepEqual(span.errorAttrs, {})
  })
})

describe('filteredAttrs', () => {
  test('should return empty object when attributes object is empty', () => {
    const span = new SpanEvent({}, {})
    const filtered = span.filteredAttrs
    assert.deepStrictEqual(filtered, {})
  })

  test('should return only entity relationship attributes when present', () => {
    const span = new SpanEvent({
      'db.system': 'postgresql',
      attr: 'should-be-excluded'
    }, {})
    const filtered = span.filteredAttrs
    assert.equal(filtered['db.system'], 'postgresql')
    assert.equal(filtered['attr'], undefined)

    // modified attributes should not affect cached result
    span.attributes['db.system'] = 'mysql'
    span.attributes['new.attr'] = 'new-value'

    // Second access should return cached result
    const filtered2 = span.filteredAttrs
    assert.equal(filtered2['db.system'], 'postgresql')
    assert.equal(filtered2['new.attr'], undefined)
  })

  test('should include error.* attributes when present', () => {
    const span = new SpanEvent({
      'db.system': 'postgresql',
      'error.class': 'TestError',
      'error.message': 'Connection failed',
      attr: 'excluded'
    }, {})
    const filtered = span.filteredAttrs
    assert.equal(filtered['db.system'], 'postgresql')
    assert.equal(filtered['error.message'], 'Connection failed')
    assert.equal(filtered['error.class'], 'TestError')
    assert.equal(filtered['attr'], undefined)
  })
})

describe('hasSameEntityAttrs', () => {
  test('should return true when both spans have identical entity relationship attributes', () => {
    const span1 = new SpanEvent({
      'db.system': 'postgresql',
      'db.instance': 'my-database',
      'server.address': 'db.example.com'
    }, {})
    const span2 = new SpanEvent({
      'db.system': 'postgresql',
      'db.instance': 'my-database',
      'server.address': 'db.example.com'
    }, {})
    assert.equal(span1.hasSameEntityAttrs(span2), true)
  })

  test('should return false when entity relationship attribute values differ', () => {
    const span1 = new SpanEvent({
      'db.system': 'postgresql',
      'server.address': 'db1.example.com'
    }, {})
    const span2 = new SpanEvent({
      'db.system': 'postgresql',
      'server.address': 'db2.example.com'
    }, {})
    assert.equal(span1.hasSameEntityAttrs(span2), false)
  })

  test('should return false when one span has entity attributes and the other does not', () => {
    const span1 = new SpanEvent({
      'db.system': 'postgresql',
      'server.address': 'db.example.com'
    }, {})
    const span2 = new SpanEvent({ attr: 'value' }, {})
    assert.equal(span1.hasSameEntityAttrs(span2), false)
  })

  test('should return false when spans have different entity attribute keys', () => {
    const span1 = new SpanEvent({
      'db.system': 'postgresql',
      'db.instance': 'my-database'
    }, {})
    const span2 = new SpanEvent({
      'db.system': 'postgresql',
      'server.address': 'db.example.com'
    }, {})
    assert.equal(span1.hasSameEntityAttrs(span2), false)
  })

  test('should ignore error.* attributes when comparing', () => {
    const span1 = new SpanEvent({
      'db.system': 'postgresql',
      'error.message': 'Error 1'
    }, {})
    const span2 = new SpanEvent({
      'db.system': 'postgresql',
      'error.message': 'Error 2'
    }, {})
    assert.equal(span1.hasSameEntityAttrs(span2), true)
  })

  test('should ignore custom attributes when comparing', () => {
    const span1 = new SpanEvent({
      'db.system': 'redis',
      attr: 'value1'
    }, {})
    const span2 = new SpanEvent({
      'db.system': 'redis',
      attr: 'value2'
    }, {})
    assert.equal(span1.hasSameEntityAttrs(span2), true)
  })
})

describe('getEntityGroup', () => {
  test('should return matching entity group when found', () => {
    const span1 = new SpanEvent({
      'db.system': 'postgresql',
      'server.address': 'db.example.com'
    }, {})
    const span2 = new SpanEvent({
      'db.system': 'mysql',
      'server.address': 'db2.example.com'
    }, {})
    const span3 = new SpanEvent({
      'db.system': 'postgresql',
      'server.address': 'db.example.com'
    }, {})

    const group1 = [span1]
    const group2 = [span2]
    const trace = {
      compactSpanGroups: {
        1: group1,
        2: group2
      }
    }

    const result = span3.getEntityGroup(trace)
    assert.equal(result, group1)
    assert.deepStrictEqual(result, [span1])
  })
  test('should return null when trace has no compactSpanGroups', () => {
    const span = new SpanEvent({
      'db.system': 'postgresql',
      'server.address': 'db.example.com'
    }, {})
    const trace = {
      compactSpanGroups: {}
    }
    const result = span.getEntityGroup(trace)
    assert.equal(result, null)
  })

  test('should return null when no matching entity group is found', () => {
    const span1 = new SpanEvent({
      'db.system': 'postgresql',
      'server.address': 'db1.example.com'
    }, {})
    const span2 = new SpanEvent({
      'db.system': 'mysql',
      'server.address': 'db2.example.com'
    }, {})
    const span3 = new SpanEvent({
      'db.system': 'redis',
      'server.address': 'cache.example.com'
    }, {})

    const trace = {
      compactSpanGroups: {
        1: [span1],
        2: [span2]
      }
    }

    const result = span3.getEntityGroup(trace)
    assert.equal(result, null)
  })
})
