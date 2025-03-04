/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const DatastoreShim = require('../../../lib/shim/datastore-shim')
const helper = require('../../lib/agent_helper')
const https = require('https')
const SpanEvent = require('../../../lib/spans/span-event')
const DatastoreParameters = require('../../../lib/shim/specs/params/datastore')
const { QuerySpec } = require('../../../lib/shim/specs')

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

test('fromSegment()', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should create a generic span with a random segment', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      transaction.sampled = true
      transaction.priority = 42

      setTimeout(() => {
        const tx = agent.tracer.getTransaction()
        const [segment] = tx.trace.getChildren(tx.trace.root.id)
        segment.addSpanAttribute('SpiderSpan', 'web')
        segment.addSpanAttribute('host', 'my-host')
        segment.addSpanAttribute('port', 222)

        const spanContext = segment.getSpanContext()
        spanContext.addCustomAttribute('Span Lee', 'no prize')

        const span = SpanEvent.fromSegment(segment, transaction, 'parent')

        // Should have all the normal properties.
        assert.ok(span)
        assert.ok(span instanceof SpanEvent)

        assert.ok(span.intrinsics)
        assert.equal(span.intrinsics.type, 'Span')
        assert.equal(span.intrinsics.category, SpanEvent.CATEGORIES.GENERIC)

        assert.equal(span.intrinsics.traceId, transaction.traceId)
        assert.equal(span.intrinsics.guid, segment.id)
        assert.equal(span.intrinsics.parentId, 'parent')
        assert.equal(span.intrinsics.transactionId, transaction.id)
        assert.equal(span.intrinsics.sampled, true)
        assert.equal(span.intrinsics.priority, 42)
        assert.equal(span.intrinsics.name, 'timers.setTimeout')
        assert.equal(span.intrinsics.timestamp, segment.timer.start)

        assert.ok(span.intrinsics.duration >= 0.03 && span.intrinsics.duration <= 0.3)

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
      }, 50)
    })
  })

  await t.test('should create an http span with a external segment', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      transaction.sampled = true
      transaction.priority = 42

      https.get('https://example.com?foo=bar', (res) => {
        res.resume()
        res.on('end', () => {
          const tx = agent.tracer.getTransaction()
          const [segment] = tx.trace.getChildren(tx.trace.root.id)
          const span = SpanEvent.fromSegment(segment, transaction, 'parent')

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

          assert.ok(span.intrinsics.duration >= 0.01 && span.intrinsics.duration <= 2)

          // Should have type-specific intrinsics
          assert.equal(span.intrinsics.component, 'http')
          assert.equal(span.intrinsics['span.kind'], 'client')

          assert.ok(span.attributes)
          const attributes = span.attributes

          // Should have (most) http properties.
          assert.equal(attributes['http.url'], 'https://example.com/')
          assert.equal(attributes['server.address'], 'example.com')
          assert.equal(attributes['server.port'], 443)
          assert.ok(attributes['http.method'])
          assert.ok(attributes['http.request.method'])
          assert.equal(attributes['http.statusCode'], 200)
          assert.equal(attributes['http.statusText'], 'OK')

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
        const span = SpanEvent.fromSegment(segment, transaction, 'parent')

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
        const span = SpanEvent.fromSegment(segment, transaction, 'parent')

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

        const span = SpanEvent.fromSegment(segment, transaction, 'parent')

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
    helper.runInTransaction(agent, (transaction) => {
      https.get('https://example.com?foo=bar', (res) => {
        transaction.end() // prematurely end to truncate

        res.resume()
        res.on('end', () => {
          const [segment] = transaction.trace.getChildren(transaction.trace.root.id)
          assert.ok(segment.name.startsWith('Truncated'))

          const span = SpanEvent.fromSegment(segment, transaction)
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

      const span = SpanEvent.fromSegment(segment, transaction)
      assert.ok(span)
      assert.ok(span instanceof SpanEvent)
      assert.ok(span instanceof SpanEvent.DatastoreSpanEvent)

      end()
    })
  })
})
