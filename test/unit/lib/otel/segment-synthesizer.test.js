/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')

const helper = require('#testlib/agent_helper.js')
const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')
const SegmentSynthesizer = require('#agentlib/otel/traces/segment-synthesis.js')
const createMockLogger = require('../../mocks/logger')
const {
  createConsumerSpan,
  createDbSpan,
  createDbClientSpan,
  createSpan,
  createHttpClientSpan,
  createHttpServerSpan,
  createMongoDbSpan,
  createRedisDbSpan,
  createRpcServerSpan,
  createMemcachedDbSpan,
  createProducerSpan,
} = require('./fixtures')
const {
  ATTR_MESSAGING_DESTINATION,
  ATTR_MESSAGING_SYSTEM,
} = require('#agentlib/otel/traces/constants.js')
const { SpanKind, TraceFlags } = require('@opentelemetry/api')
const hashes = require('#agentlib/util/hashes.js')

test.beforeEach((ctx) => {
  const loggerMock = createMockLogger()
  const agent = helper.loadMockedAgent()
  const synthesizer = new SegmentSynthesizer(agent, { logger: loggerMock })
  const tracer = new BasicTracerProvider().getTracer('default')
  ctx.nr = {
    agent,
    loggerMock,
    synthesizer,
    tracer
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should create http external segment from otel http client span', (t, end) => {
  const { agent, synthesizer, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createHttpClientSpan({ tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'External/www.newrelic.com/search')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should create db segment', (t, end) => {
  const { agent, synthesizer, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createDbClientSpan({ tracer })
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
  const { agent, synthesizer, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createMongoDbSpan({ tracer })
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
  const { agent, synthesizer, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createRedisDbSpan({ tracer })
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
  const { agent, synthesizer, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createMemcachedDbSpan({ tracer })
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
  const { agent, synthesizer, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createDbSpan({ tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'Datastore/statement/custom-db/unknown/unknown')
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
  assert.equal(segment.name, 'test-span')
  assert.equal(segment.id, span.spanContext().spanId)
  assert.equal(segment.parentId, segment.root.id)
  assert.ok(transaction)
  assert.equal(transaction.traceId, span.spanContext().traceId)
  assert.equal(transaction.baseSegment.name, segment.name)
  transaction.end()
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
  assert.equal(segment.name, 'test-span')
  assert.equal(segment.id, span.spanContext().spanId)
  assert.equal(segment.parentId, segment.root.id)
  assert.ok(transaction)
  assert.equal(transaction.traceId, span.spanContext().traceId)
  assert.equal(transaction.baseSegment.name, segment.name)
  transaction.end()
})

test('should not create tx if one already exists when a server span is created', (t, end) => {
  const { agent, synthesizer, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'test-tx'
    const span = createHttpServerSpan({ tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.deepEqual(tx, transaction)
    assert.equal(segment.name, 'test-span')
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.parentId, segment.root.id)
    end()
  })
})

test('should create producer segment', (t, end) => {
  const { agent, synthesizer, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createProducerSpan({ tracer })
    const { segment, transaction } = synthesizer.synthesize(span)
    assert.equal(tx.id, transaction.id)
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.name, 'MessageBroker/messaging-lib/send/Produce/Named/test-topic')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should create internal custom segment', (t, end) => {
  const { agent, synthesizer, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const span = createSpan({
      name: 'doer-of-stuff',
      kind: SpanKind.INTERNAL,
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
  const span = createConsumerSpan({ tracer, spanContext })
  const { segment, transaction } = synthesizer.synthesize(span)
  transaction.end()
  assert.equal(segment.name, 'test-span')
  assert.equal(segment.id, span.spanContext().spanId)
  assert.equal(transaction.traceId, span.spanContext().traceId)
  assert.equal(segment.parentId, segment.root.id)
  assert.equal(transaction.baseSegment, segment)
})

test('should not create tx if one already exists when a consumer span is created', (t, end) => {
  const { agent, synthesizer, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'test-tx'
    const span = createSpan({ tracer, kind: SpanKind.CONSUMER })
    span.name = 'test-span'
    span.setAttribute('messaging.operation', 'receive')
    span.setAttribute(ATTR_MESSAGING_SYSTEM, 'msgqueuer')
    span.setAttribute(ATTR_MESSAGING_DESTINATION, 'dest1')

    const { segment, transaction } = synthesizer.synthesize(span)
    assert.deepEqual(tx, transaction)
    assert.equal(segment.name, 'test-span')
    assert.equal(segment.id, span.spanContext().spanId)
    assert.equal(segment.parentId, segment.root.id)
    end()
  })
})

test('should log warning span does not match a rule', (t, end) => {
  const { agent, synthesizer, loggerMock, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createSpan({ name: 'test-span', kind: 'bogus', tracer })
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
