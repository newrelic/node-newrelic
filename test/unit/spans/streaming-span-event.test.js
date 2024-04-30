/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const DatastoreShim = require('../../../lib/shim/datastore-shim')
const helper = require('../../lib/agent_helper')
const https = require('https')
const StreamingSpanEvent = require('../../../lib/spans/streaming-span-event')

const CATEGORIES = {
  HTTP: 'http',
  DATASTORE: 'datastore',
  GENERIC: 'generic'
}

const STRING_TYPE = 'string_value'
const BOOL_TYPE = 'bool_value'
const INT_TYPE = 'int_value'
const DOUBLE_TYPE = 'double_value'

tap.test('#constructor() should construct an empty span event', (t) => {
  const attrs = {}
  const span = new StreamingSpanEvent(attrs)

  t.ok(span)
  t.ok(span instanceof StreamingSpanEvent)
  t.same(span._agentAttributes, attrs)

  t.ok(span._intrinsicAttributes)
  t.same(span._intrinsicAttributes.type, { [STRING_TYPE]: 'Span' })
  t.same(span._intrinsicAttributes.category, { [STRING_TYPE]: CATEGORIES.GENERIC })

  t.end()
})

tap.test('fromSegment()', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({
      distributed_tracing: {
        enabled: true
      }
    })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should create a generic span with a random segment', (t) => {
    helper.runInTransaction(agent, (transaction) => {
      transaction.sampled = true
      transaction.priority = 42

      setTimeout(() => {
        const segment = agent.tracer.getTransaction().trace.root.children[0]
        const spanContext = segment.getSpanContext()
        spanContext.addCustomAttribute('Span Lee', 'no prize')

        const span = StreamingSpanEvent.fromSegment(segment, 'parent')

        // Should have all the normal properties.
        t.ok(span)
        t.ok(span instanceof StreamingSpanEvent)

        t.ok(span._intrinsicAttributes)
        t.same(span._intrinsicAttributes.type, { [STRING_TYPE]: 'Span' })
        t.same(span._intrinsicAttributes.category, { [STRING_TYPE]: CATEGORIES.GENERIC })

        t.same(span._intrinsicAttributes.traceId, { [STRING_TYPE]: transaction.traceId })
        t.same(span._intrinsicAttributes.guid, { [STRING_TYPE]: segment.id })
        t.same(span._intrinsicAttributes.parentId, { [STRING_TYPE]: 'parent' })
        t.same(span._intrinsicAttributes.transactionId, { [STRING_TYPE]: transaction.id })
        t.same(span._intrinsicAttributes.sampled, { [BOOL_TYPE]: true })
        t.same(span._intrinsicAttributes.priority, { [INT_TYPE]: 42 })
        t.same(span._intrinsicAttributes.name, { [STRING_TYPE]: 'timers.setTimeout' })
        t.same(span._intrinsicAttributes.timestamp, { [INT_TYPE]: segment.timer.start })

        t.ok(span._intrinsicAttributes.duration)
        t.ok(span._intrinsicAttributes.duration[DOUBLE_TYPE])

        // Generic should not have 'span.kind' or 'component'
        const hasIntrinsic = Object.hasOwnProperty.bind(span._intrinsicAttributes)
        t.notOk(hasIntrinsic('span.kind'))
        t.notOk(hasIntrinsic('component'))

        const customAttributes = span._customAttributes
        t.ok(customAttributes)
        t.same(customAttributes['Span Lee'], { [STRING_TYPE]: 'no prize' })

        const agentAttributes = span._agentAttributes
        t.ok(agentAttributes)

        // Should have no http properties.
        const hasOwnAttribute = Object.hasOwnProperty.bind(agentAttributes)
        t.notOk(hasOwnAttribute('externalLibrary'))
        t.notOk(hasOwnAttribute('externalUri'))
        t.notOk(hasOwnAttribute('externalProcedure'))

        // Should have no datastore properties.
        t.notOk(hasOwnAttribute('db.statement'))
        t.notOk(hasOwnAttribute('db.instance'))
        t.notOk(hasOwnAttribute('peer.hostname'))
        t.notOk(hasOwnAttribute('peer.address'))

        t.end()
      }, 50)
    })
  })

  t.test('should create an http span with a external segment', (t) => {
    helper.runInTransaction(agent, (transaction) => {
      transaction.sampled = true
      transaction.priority = 42

      https.get('https://example.com?foo=bar', (res) => {
        res.resume()
        res.on('end', () => {
          const segment = agent.tracer.getTransaction().trace.root.children[0]
          const span = StreamingSpanEvent.fromSegment(segment, 'parent')

          // Should have all the normal properties.
          t.ok(span)
          t.ok(span instanceof StreamingSpanEvent)

          t.ok(span._intrinsicAttributes)
          t.same(span._intrinsicAttributes.type, { [STRING_TYPE]: 'Span' })
          t.same(span._intrinsicAttributes.category, { [STRING_TYPE]: CATEGORIES.HTTP })

          t.same(span._intrinsicAttributes.traceId, { [STRING_TYPE]: transaction.traceId })
          t.same(span._intrinsicAttributes.guid, { [STRING_TYPE]: segment.id })
          t.same(span._intrinsicAttributes.parentId, { [STRING_TYPE]: 'parent' })
          t.same(span._intrinsicAttributes.transactionId, { [STRING_TYPE]: transaction.id })
          t.same(span._intrinsicAttributes.sampled, { [BOOL_TYPE]: true })
          t.same(span._intrinsicAttributes.priority, { [INT_TYPE]: 42 })

          t.same(span._intrinsicAttributes.name, { [STRING_TYPE]: 'External/example.com/' })
          t.same(span._intrinsicAttributes.timestamp, { [INT_TYPE]: segment.timer.start })

          t.ok(span._intrinsicAttributes.duration)
          t.ok(span._intrinsicAttributes.duration[DOUBLE_TYPE])

          // Should have type-specific intrinsics
          t.same(span._intrinsicAttributes.component, { [STRING_TYPE]: 'http' })
          t.same(span._intrinsicAttributes['span.kind'], { [STRING_TYPE]: 'client' })

          const agentAttributes = span._agentAttributes
          t.ok(agentAttributes)

          // Should have (most) http properties.
          t.same(agentAttributes['http.url'], { [STRING_TYPE]: 'https://example.com/' })
          t.same(agentAttributes['server.address'], { [STRING_TYPE]: 'example.com' })
          t.same(agentAttributes['server.port'], { [INT_TYPE]: 443 })
          t.ok(agentAttributes['http.method'])
          t.ok(agentAttributes['http.request.method'])
          t.same(agentAttributes['http.statusCode'], { [INT_TYPE]: 200 })
          t.same(agentAttributes['http.statusText'], { [STRING_TYPE]: 'OK' })

          // Should have no datastore properties.
          const hasOwnAttribute = Object.hasOwnProperty.bind(agentAttributes)
          t.notOk(hasOwnAttribute('db.statement'))
          t.notOk(hasOwnAttribute('db.instance'))
          t.notOk(hasOwnAttribute('peer.hostname'))
          t.notOk(hasOwnAttribute('peer.address'))

          t.end()
        })
      })
    })
  })

  t.test('should create an datastore span with an datastore segment', (t) => {
    agent.config.transaction_tracer.record_sql = 'raw'

    const shim = new DatastoreShim(agent, 'test-data-store')
    shim.setDatastore('TestStore')

    const dsConn = { myDbOp: (query, cb) => setTimeout(cb, 50) }
    let longQuery = ''
    while (Buffer.byteLength(longQuery, 'utf8') < 2001) {
      longQuery += 'a'
    }
    shim.recordQuery(dsConn, 'myDbOp', {
      callback: shim.LAST,
      query: shim.FIRST,
      parameters: {
        host: 'my-db-host',
        port_path_or_id: '/path/to/db.sock',
        database_name: 'my-database',
        collection: 'my-collection'
      }
    })

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
        const span = StreamingSpanEvent.fromSegment(segment, 'parent')

        // Should have all the normal properties.
        t.ok(span)
        t.ok(span instanceof StreamingSpanEvent)

        t.ok(span._intrinsicAttributes)
        t.same(span._intrinsicAttributes.type, { [STRING_TYPE]: 'Span' })
        t.same(span._intrinsicAttributes.category, { [STRING_TYPE]: CATEGORIES.DATASTORE })

        t.same(span._intrinsicAttributes.traceId, { [STRING_TYPE]: transaction.traceId })
        t.same(span._intrinsicAttributes.guid, { [STRING_TYPE]: segment.id })
        t.same(span._intrinsicAttributes.parentId, { [STRING_TYPE]: 'parent' })
        t.same(span._intrinsicAttributes.transactionId, { [STRING_TYPE]: transaction.id })
        t.same(span._intrinsicAttributes.sampled, { [BOOL_TYPE]: true })
        t.same(span._intrinsicAttributes.priority, { [INT_TYPE]: 42 })

        t.same(span._intrinsicAttributes.name, {
          [STRING_TYPE]: 'Datastore/statement/TestStore/test/test'
        })

        t.same(span._intrinsicAttributes.timestamp, { [INT_TYPE]: segment.timer.start })

        t.ok(span._intrinsicAttributes.duration)
        t.ok(span._intrinsicAttributes.duration[DOUBLE_TYPE])

        // Should have (most) type-specific intrinsics
        t.same(span._intrinsicAttributes.component, { [STRING_TYPE]: 'TestStore' })
        t.same(span._intrinsicAttributes['span.kind'], { [STRING_TYPE]: 'client' })

        const agentAttributes = span._agentAttributes
        t.ok(agentAttributes)

        // Should have not http properties.
        const hasOwnAttribute = Object.hasOwnProperty.bind(agentAttributes)
        t.notOk(hasOwnAttribute('http.url'))
        t.notOk(hasOwnAttribute('server.address'))
        t.notOk(hasOwnAttribute('http.method'))
        t.notOk(hasOwnAttribute('http.request.method'))

        // Should have (most) datastore properties.
        t.ok(agentAttributes['db.instance'])
        t.same(agentAttributes['db.collection'], { [STRING_TYPE]: 'my-collection' })
        t.same(agentAttributes['peer.hostname'], { [STRING_TYPE]: 'my-db-host' })
        t.same(agentAttributes['peer.address'], { [STRING_TYPE]: 'my-db-host:/path/to/db.sock' })

        const statement = agentAttributes['db.statement']
        t.ok(statement)

        // Testing query truncation
        const actualValue = statement[STRING_TYPE]
        t.ok(actualValue)
        t.ok(actualValue.endsWith('...'))
        t.equal(Buffer.byteLength(actualValue, 'utf8'), 2000)

        t.end()
      })
    })
  })

  t.test('should serialize to proper format with toStreamingFormat()', (t) => {
    helper.runInTransaction(agent, (transaction) => {
      transaction.priority = 42
      transaction.sampled = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()
        segment.addAttribute('anAgentAttribute', true)

        const spanContext = agent.tracer.getSpanContext()
        spanContext.addCustomAttribute('customKey', 'customValue')

        const span = StreamingSpanEvent.fromSegment(segment, 'parent')

        const serializedSpan = span.toStreamingFormat()
        const {
          trace_id: traceId,
          intrinsics,
          user_attributes: userAttributes,
          agent_attributes: agentAttributes
        } = serializedSpan

        t.equal(traceId, transaction.traceId)

        // Spot check a few known attributes
        t.same(intrinsics.type, { [STRING_TYPE]: 'Span' })
        t.same(intrinsics.traceId, { [STRING_TYPE]: transaction.traceId })

        t.same(userAttributes.customKey, { [STRING_TYPE]: 'customValue' })

        t.same(agentAttributes.anAgentAttribute, { [BOOL_TYPE]: true })

        t.end()
      }, 10)
    })
  })

  t.test('should populate intrinsics from span context', (t) => {
    helper.runInTransaction(agent, (transaction) => {
      transaction.priority = 42
      transaction.sampled = true

      setTimeout(() => {
        const segment = agent.tracer.getSegment()
        const spanContext = segment.getSpanContext()
        spanContext.addIntrinsicAttribute('intrinsic.1', 1)
        spanContext.addIntrinsicAttribute('intrinsic.2', 2)

        const span = StreamingSpanEvent.fromSegment(segment, 'parent')

        const serializedSpan = span.toStreamingFormat()
        const { intrinsics } = serializedSpan

        t.same(intrinsics['intrinsic.1'], { [INT_TYPE]: 1 })
        t.same(intrinsics['intrinsic.2'], { [INT_TYPE]: 2 })

        t.end()
      }, 10)
    })
  })

  t.test('should handle truncated http spans', (t) => {
    helper.runInTransaction(agent, (transaction) => {
      https.get('https://example.com?foo=bar', (res) => {
        transaction.end() // prematurely end to truncate

        res.resume()
        res.on('end', () => {
          const segment = transaction.trace.root.children[0]
          t.ok(segment.name.startsWith('Truncated'))

          const span = StreamingSpanEvent.fromSegment(segment)
          t.ok(span)
          t.ok(span instanceof StreamingSpanEvent)

          t.ok(span._intrinsicAttributes)
          t.same(span._intrinsicAttributes.category, { [STRING_TYPE]: CATEGORIES.HTTP })
          t.same(span._intrinsicAttributes['span.kind'], { [STRING_TYPE]: 'client' })

          t.end()
        })
      })
    })
  })

  t.test('should handle truncated datastore spans', (t) => {
    helper.runInTransaction(agent, (transaction) => {
      const segment = transaction.trace.root.add('Datastore/operation/something')
      transaction.end() // end before segment to trigger truncate

      t.ok(segment.name.startsWith('Truncated'))

      const span = StreamingSpanEvent.fromSegment(segment)
      t.ok(span)
      t.ok(span instanceof StreamingSpanEvent)

      t.same(span._intrinsicAttributes.category, { [STRING_TYPE]: CATEGORIES.DATASTORE })
      t.same(span._intrinsicAttributes['span.kind'], { [STRING_TYPE]: 'client' })

      t.end()
    })
  })
})
