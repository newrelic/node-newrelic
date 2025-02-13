/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')

const helper = require('#testlib/agent_helper.js')
const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')
const SegmentSynthesizer = require('#agentlib/otel/segment-synthesis.js')
const createMockLogger = require('../../mocks/logger')
const {
  createBaseHttpSpan,
  createDbClientSpan,
  createSpan,
  createHttpClientSpan,
  createHttpServerSpan,
  createDbStatementSpan,
  createMongoDbSpan,
  createRedisDbSpan,
  createRpcServerSpan,
  createMemcachedDbSpan,
  createTopicProducerSpan,
  createQueueProducerSpan
} = require('./fixtures')
const {
  ATTR_DB_SYSTEM,
  ATTR_MESSAGING_DESTINATION,
  ATTR_MESSAGING_DESTINATION_KIND,
  ATTR_MESSAGING_SYSTEM
} = require('#agentlib/otel/constants.js')
const { SpanKind, TraceFlags } = require('@opentelemetry/api')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const hashes = require('#agentlib/util/hashes.js')

test.beforeEach((ctx) => {
  const loggerMock = createMockLogger()
  const agent = helper.loadMockedAgent()
  const synthesizer = new SegmentSynthesizer(agent, { logger: loggerMock })
  const tracer = new BasicTracerProvider().getTracer('default')
  const parentId = '5c1c63257de34c67'
  ctx.nr = {
    agent,
    loggerMock,
    parentId,
    synthesizer,
    tracer
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should create http external segment from otel http client span', (t, end) => {
  const { agent, synthesizer, parentId, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tx, parentId, tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'External/newrelic.com')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should create db segment', (t, end) => {
  const { agent, synthesizer, parentId, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createDbClientSpan({ tx, parentId, tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'Datastore/statement/custom-db/test-table/select')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should create db segment and get operation and table from db.statement', (t, end) => {
  const { agent, synthesizer, parentId, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createDbStatementSpan({ tx, parentId, tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'Datastore/statement/custom-db/test-table/select')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should create db segment and get collection from db.mongodb.collection', (t, end) => {
  const { agent, synthesizer, parentId, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createMongoDbSpan({ tx, parentId, tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'Datastore/statement/mongodb/test-collection/insert')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should create db segment and get operation from db.statement when system is redis', (t, end) => {
  const { agent, synthesizer, parentId, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createRedisDbSpan({ tx, parentId, tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'Datastore/operation/redis/hset')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should create db segment and get operation from db.operation when system is memcached', (t, end) => {
  const { agent, synthesizer, parentId, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createMemcachedDbSpan({ tx, parentId, tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'Datastore/operation/memcached/set')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should log table and operation as unknown when the db.system, db.sql.table and db.operation to not exist as span attributes', (t, end) => {
  const { agent, synthesizer, parentId, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createSpan({ name: 'test-span', kind: SpanKind.CLIENT, parentId, tx, tracer })
    span.setAttribute(ATTR_DB_SYSTEM, 'test-db')

    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'Datastore/statement/test-db/Unknown/Unknown')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should create rpc segment', (t) => {
  const { synthesizer, tracer } = t.nr
  const spanContext = {
    spanId: hashes.makeId(),
    traceId: hashes.makeId(),
    traceFlags: TraceFlags.SAMPLED
  }
  const span = createRpcServerSpan({ tracer, spanContext })
  const { segment, transaction } = synthesizer.synthesize(span)
  const expectedName = 'TestService/findUser'
  assert.equal(segment.name, expectedName)
  assert.equal(segment.id, span.spanContext().spanId)
  assert.equal(segment.parentId, segment.root.id)
  assert.ok(transaction)
  assert.equal(transaction.traceId, span.spanContext().traceId)
  const segmentAttrs = segment.getAttributes()
  assert.equal(segmentAttrs.component, 'grpc')
  assert.equal(transaction.url, expectedName)
  assert.equal(transaction.baseSegment.name, segment.name)
  const attrs = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
  assert.equal(attrs['request.method'], 'findUser')
  assert.equal(attrs['request.uri'], expectedName)
})

test('should create http server segment', (t) => {
  const { synthesizer, tracer } = t.nr
  const spanContext = {
    spanId: hashes.makeId(),
    traceId: hashes.makeId(),
    traceFlags: TraceFlags.SAMPLED
  }
  const span = createHttpServerSpan({ tracer, spanContext })
  const { segment, transaction } = synthesizer.synthesize(span)
  assert.equal(segment.name, '/user/1')
  assert.equal(segment.id, span.spanContext().spanId)
  assert.equal(segment.parentId, segment.root.id)
  assert.ok(transaction)
  assert.equal(transaction.traceId, span.spanContext().traceId)
  assert.equal(transaction.url, '/user/1')
  assert.equal(transaction.baseSegment.name, segment.name)
  const attrs = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
  assert.equal(attrs['request.method'], 'PUT')
  assert.equal(attrs['request.uri'], '/user/1')
  transaction.end()
})

test('should create base http server segment', (t) => {
  const { synthesizer, tracer } = t.nr
  const spanContext = {
    spanId: hashes.makeId(),
    traceId: hashes.makeId(),
    traceFlags: TraceFlags.SAMPLED
  }
  const span = createBaseHttpSpan({ tracer, spanContext })
  const { segment, transaction } = synthesizer.synthesize(span)
  assert.equal(segment.name, '/Unknown')
  assert.equal(segment.id, span.spanContext().spanId)
  assert.equal(segment.parentId, segment.root.id)
  assert.ok(transaction)
  assert.equal(transaction.traceId, span.spanContext().traceId)
  assert.equal(transaction.url, '/Unknown')
  assert.equal(transaction.baseSegment.name, segment.name)
  const attrs = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
  assert.equal(attrs['request.uri'], '/Unknown')
  assert.ok(!attrs['request.method'])
  assert.ok(transaction)
})

test('should create topic producer segment', (t, end) => {
  const { agent, synthesizer, parentId, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createTopicProducerSpan({ tx, parentId, tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'MessageBroker/messaging-lib/topic/Produce/Named/test-topic')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should create queue producer segment', (t, end) => {
  const { agent, synthesizer, parentId, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createQueueProducerSpan({ tx, parentId, tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'MessageBroker/messaging-lib/queue/Produce/Named/test-queue')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should create internal custom segment', (t, end) => {
  const { agent, synthesizer, parentId, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createSpan({
      name: 'doer-of-stuff',
      kind: SpanKind.INTERNAL,
      parentId,
      tx,
      tracer
    })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'doer-of-stuff')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should create consumer segment from otel span', (t) => {
  const { synthesizer, tracer } = t.nr
  const spanContext = {
    spanId: hashes.makeId(),
    traceId: hashes.makeId(),
    traceFlags: TraceFlags.SAMPLED
  }
  const span = createSpan({ tracer, kind: SpanKind.CONSUMER, spanContext })
  span.setAttribute('messaging.operation', 'receive')
  span.setAttribute(ATTR_MESSAGING_SYSTEM, 'msgqueuer')
  span.setAttribute(ATTR_MESSAGING_DESTINATION, 'dest1')
  span.setAttribute(ATTR_MESSAGING_DESTINATION_KIND, 'topic1')

  const expectedName = 'OtherTransaction/Message/msgqueuer/topic1/Named/dest1'
  const { segment, transaction } = synthesizer.synthesize(span)
  transaction.end()
  assert.equal(segment.name, expectedName)
  assert.equal(segment.id, span.spanContext().spanId)
  assert.equal(transaction.traceId, span.spanContext().traceId)
  assert.equal(segment.parentId, segment.root.id)
  assert.equal(transaction.name, expectedName)
  assert.equal(transaction.type, 'message')
  assert.equal(transaction.baseSegment, segment)
})

test('should log warning span does not match a rule', (t, end) => {
  const { agent, synthesizer, loggerMock, parentId, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createSpan({ name: 'test-span', kind: 'bogus', parentId, tx, tracer })
    const data = synthesizer.synthesize(span)
    assert.ok(!data)
    assert.deepEqual(loggerMock.debug.args[0], [
      'Cannot match a rule to span name: %s, kind %s',
      'test-span',
      'bogus'
    ])
    tx.end()
    end()
  })
})
