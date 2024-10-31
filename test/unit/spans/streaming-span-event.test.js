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
const StreamingSpanEvent = require('../../../lib/spans/streaming-span-event')
const {
  QuerySpec,
  params: { DatastoreParameters }
} = require('../../../lib/shim/specs')

const CATEGORIES = {
  HTTP: 'http',
  DATASTORE: 'datastore',
  GENERIC: 'generic'
}

const STRING_TYPE = 'string_value'
const BOOL_TYPE = 'bool_value'
const INT_TYPE = 'int_value'
const DOUBLE_TYPE = 'double_value'

test('#constructor() should construct an empty span event', () => {
  const attrs = {}
  const span = new StreamingSpanEvent(attrs)

  assert.ok(span)
  assert.ok(span instanceof StreamingSpanEvent)
  assert.deepEqual(span._agentAttributes, attrs)

  assert.ok(span._intrinsicAttributes)
  assert.deepEqual(span._intrinsicAttributes.type, { [STRING_TYPE]: 'Span' })
  assert.deepEqual(span._intrinsicAttributes.category, { [STRING_TYPE]: CATEGORIES.GENERIC })
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
        const segment = agent.tracer.getTransaction().trace.root.children[0]
        const spanContext = segment.getSpanContext()
        spanContext.addCustomAttribute('Span Lee', 'no prize')
        segment.addSpanAttribute('host', 'my-host')
        segment.addSpanAttribute('port', 22)

        const span = StreamingSpanEvent.fromSegment(segment, transaction, 'parent')

        // Should have all the normal properties.
        assert.ok(span)
        assert.ok(span instanceof StreamingSpanEvent)

        assert.ok(span._intrinsicAttributes)
        assert.deepEqual(span._intrinsicAttributes.type, { [STRING_TYPE]: 'Span' })
        assert.deepEqual(span._intrinsicAttributes.category, { [STRING_TYPE]: CATEGORIES.GENERIC })

        assert.deepEqual(span._intrinsicAttributes.traceId, { [STRING_TYPE]: transaction.traceId })
        assert.deepEqual(span._intrinsicAttributes.guid, { [STRING_TYPE]: segment.id })
        assert.deepEqual(span._intrinsicAttributes.parentId, { [STRING_TYPE]: 'parent' })
        assert.deepEqual(span._intrinsicAttributes.transactionId, { [STRING_TYPE]: transaction.id })
        assert.deepEqual(span._intrinsicAttributes.sampled, { [BOOL_TYPE]: true })
        assert.deepEqual(span._intrinsicAttributes.priority, { [INT_TYPE]: 42 })
        assert.deepEqual(span._intrinsicAttributes.name, { [STRING_TYPE]: 'timers.setTimeout' })
        assert.deepEqual(span._intrinsicAttributes.timestamp, { [INT_TYPE]: segment.timer.start })

        assert.ok(span._intrinsicAttributes.duration)
        assert.ok(span._intrinsicAttributes.duration[DOUBLE_TYPE])

        // Generic should not have 'span.kind' or 'component'
        const hasIntrinsic = Object.hasOwnProperty.bind(span._intrinsicAttributes)
        assert.ok(!hasIntrinsic('span.kind'))
        assert.ok(!hasIntrinsic('component'))

        const customAttributes = span._customAttributes
        assert.ok(customAttributes)
        assert.deepEqual(customAttributes['Span Lee'], { [STRING_TYPE]: 'no prize' })

        const agentAttributes = span._agentAttributes
        assert.ok(agentAttributes)

        assert.deepEqual(agentAttributes['server.address'], { [STRING_TYPE]: 'my-host' })
        assert.deepEqual(agentAttributes['server.port'], { [INT_TYPE]: 22 })

        // Should have no http properties.
        const hasOwnAttribute = Object.hasOwnProperty.bind(agentAttributes)
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
          const segment = agent.tracer.getTransaction().trace.root.children[0]
          const span = StreamingSpanEvent.fromSegment(segment, transaction, 'parent')

          // Should have all the normal properties.
          assert.ok(span)
          assert.ok(span instanceof StreamingSpanEvent)

          assert.ok(span._intrinsicAttributes)
          assert.deepEqual(span._intrinsicAttributes.type, { [STRING_TYPE]: 'Span' })
          assert.deepEqual(span._intrinsicAttributes.category, { [STRING_TYPE]: CATEGORIES.HTTP })

          assert.deepEqual(span._intrinsicAttributes.traceId, {
            [STRING_TYPE]: transaction.traceId
          })
          assert.deepEqual(span._intrinsicAttributes.guid, { [STRING_TYPE]: segment.id })
          assert.deepEqual(span._intrinsicAttributes.parentId, { [STRING_TYPE]: 'parent' })
          assert.deepEqual(span._intrinsicAttributes.transactionId, {
            [STRING_TYPE]: transaction.id
          })
          assert.deepEqual(span._intrinsicAttributes.sampled, { [BOOL_TYPE]: true })
          assert.deepEqual(span._intrinsicAttributes.priority, { [INT_TYPE]: 42 })

          assert.deepEqual(span._intrinsicAttributes.name, {
            [STRING_TYPE]: 'External/example.com/'
          })
          assert.deepEqual(span._intrinsicAttributes.timestamp, { [INT_TYPE]: segment.timer.start })

          assert.ok(span._intrinsicAttributes.duration)
          assert.ok(span._intrinsicAttributes.duration[DOUBLE_TYPE])

          // Should have type-specific intrinsics
          assert.deepEqual(span._intrinsicAttributes.component, { [STRING_TYPE]: 'http' })
          assert.deepEqual(span._intrinsicAttributes['span.kind'], { [STRING_TYPE]: 'client' })

          const agentAttributes = span._agentAttributes
          assert.ok(agentAttributes)

          // Should have (most) http properties.
          assert.deepEqual(agentAttributes['request.parameters.foo'], { [STRING_TYPE]: 'bar' })
          assert.deepEqual(agentAttributes['http.url'], { [STRING_TYPE]: 'https://example.com/' })
          assert.deepEqual(agentAttributes['server.address'], { [STRING_TYPE]: 'example.com' })
          assert.deepEqual(agentAttributes['server.port'], { [INT_TYPE]: 443 })
          assert.ok(agentAttributes['http.method'])
          assert.ok(agentAttributes['http.request.method'])
          assert.deepEqual(agentAttributes['http.statusCode'], { [INT_TYPE]: 200 })
          assert.deepEqual(agentAttributes['http.statusText'], { [STRING_TYPE]: 'OK' })

          const hasOwnAttribute = Object.hasOwnProperty.bind(agentAttributes)

          // should remove mapped attributes
          ;['library', 'url', 'hostname', 'port', 'procedure'].forEach((attr) => {
            assert.ok(!hasOwnAttribute(attr))
          })

          // Should have no datastore properties.
          ;['db.statement', 'db.instance', 'db.system', 'peer.hostname', 'peer.address'].forEach(
            (attr) => {
              assert.ok(!hasOwnAttribute(attr))
            }
          )
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
        const segment = transaction.trace.root.children[0]
        const span = StreamingSpanEvent.fromSegment(segment, transaction, 'parent')

        // Should have all the normal properties.
        assert.ok(span)
        assert.ok(span instanceof StreamingSpanEvent)

        assert.ok(span._intrinsicAttributes)
        assert.deepEqual(span._intrinsicAttributes.type, { [STRING_TYPE]: 'Span' })
        assert.deepEqual(span._intrinsicAttributes.category, {
          [STRING_TYPE]: CATEGORIES.DATASTORE
        })

        assert.deepEqual(span._intrinsicAttributes.traceId, { [STRING_TYPE]: transaction.traceId })
        assert.deepEqual(span._intrinsicAttributes.guid, { [STRING_TYPE]: segment.id })
        assert.deepEqual(span._intrinsicAttributes.parentId, { [STRING_TYPE]: 'parent' })
        assert.deepEqual(span._intrinsicAttributes.transactionId, { [STRING_TYPE]: transaction.id })
        assert.deepEqual(span._intrinsicAttributes.sampled, { [BOOL_TYPE]: true })
        assert.deepEqual(span._intrinsicAttributes.priority, { [INT_TYPE]: 42 })

        assert.deepEqual(span._intrinsicAttributes.name, {
          [STRING_TYPE]: 'Datastore/statement/TestStore/test/test'
        })

        assert.deepEqual(span._intrinsicAttributes.timestamp, { [INT_TYPE]: segment.timer.start })

        assert.ok(span._intrinsicAttributes.duration)
        assert.ok(span._intrinsicAttributes.duration[DOUBLE_TYPE])

        // Should have (most) type-specific intrinsics
        assert.deepEqual(span._intrinsicAttributes.component, { [STRING_TYPE]: 'TestStore' })
        assert.deepEqual(span._intrinsicAttributes['span.kind'], { [STRING_TYPE]: 'client' })

        const agentAttributes = span._agentAttributes
        assert.ok(agentAttributes)

        // Should have not http properties.
        const hasOwnAttribute = Object.hasOwnProperty.bind(agentAttributes)
        ;['http.url', 'http.method', 'http.request.method'].forEach((attr) => {
          assert.ok(!hasOwnAttribute(attr))
        })

        // Should removed map attributes
        ;[
          'product',
          'collection',
          'sql',
          'sql_obfuscated',
          'database_name',
          'host',
          'port_path_or_id'
        ].forEach((attr) => {
          assert.ok(!hasOwnAttribute(attr))
        })
        // Should have (most) datastore properties.
        assert.ok(agentAttributes['db.instance'])
        assert.deepEqual(agentAttributes['db.collection'], { [STRING_TYPE]: 'my-collection' })
        assert.deepEqual(agentAttributes['peer.hostname'], { [STRING_TYPE]: 'my-db-host' })
        assert.deepEqual(agentAttributes['peer.address'], {
          [STRING_TYPE]: 'my-db-host:/path/to/db.sock'
        })
        assert.deepEqual(agentAttributes['db.system'], { [STRING_TYPE]: 'TestStore' }) // same as intrinsics.component
        assert.deepEqual(agentAttributes['server.address'], { [STRING_TYPE]: 'my-db-host' })
        assert.deepEqual(agentAttributes['server.port'], { [STRING_TYPE]: '/path/to/db.sock' })

        const statement = agentAttributes['db.statement']
        assert.ok(statement)

        // Testing query truncation
        const actualValue = statement[STRING_TYPE]
        assert.ok(actualValue)
        assert.ok(actualValue.endsWith('...'))
        assert.equal(Buffer.byteLength(actualValue, 'utf8'), 2000)

        end()
      })
    })
  })

  await t.test('should serialize to proper format with toStreamingFormat()', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      transaction.priority = 42
      transaction.sampled = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()
        segment.addAttribute('anAgentAttribute', true)

        const spanContext = agent.tracer.getSpanContext()
        spanContext.addCustomAttribute('customKey', 'customValue')

        const span = StreamingSpanEvent.fromSegment(segment, transaction, 'parent')

        const serializedSpan = span.toStreamingFormat()
        const {
          trace_id: traceId,
          intrinsics,
          user_attributes: userAttributes,
          agent_attributes: agentAttributes
        } = serializedSpan

        assert.equal(traceId, transaction.traceId)

        // Spot check a few known attributes
        assert.deepEqual(intrinsics.type, { [STRING_TYPE]: 'Span' })
        assert.deepEqual(intrinsics.traceId, { [STRING_TYPE]: transaction.traceId })

        assert.deepEqual(userAttributes.customKey, { [STRING_TYPE]: 'customValue' })

        assert.deepEqual(agentAttributes.anAgentAttribute, { [BOOL_TYPE]: true })

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

        const span = StreamingSpanEvent.fromSegment(segment, transaction, 'parent')

        const serializedSpan = span.toStreamingFormat()
        const { intrinsics } = serializedSpan

        assert.deepEqual(intrinsics['intrinsic.1'], { [INT_TYPE]: 1 })
        assert.deepEqual(intrinsics['intrinsic.2'], { [INT_TYPE]: 2 })

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
          const segment = transaction.trace.root.children[0]
          assert.ok(segment.name.startsWith('Truncated'))

          const span = StreamingSpanEvent.fromSegment(segment, transaction)
          assert.ok(span)
          assert.ok(span instanceof StreamingSpanEvent)

          assert.ok(span._intrinsicAttributes)
          assert.deepEqual(span._intrinsicAttributes.category, { [STRING_TYPE]: CATEGORIES.HTTP })
          assert.deepEqual(span._intrinsicAttributes['span.kind'], { [STRING_TYPE]: 'client' })

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

      const span = StreamingSpanEvent.fromSegment(segment, transaction)
      assert.ok(span)
      assert.ok(span instanceof StreamingSpanEvent)

      assert.deepEqual(span._intrinsicAttributes.category, { [STRING_TYPE]: CATEGORIES.DATASTORE })
      assert.deepEqual(span._intrinsicAttributes['span.kind'], { [STRING_TYPE]: 'client' })

      end()
    })
  })
})
