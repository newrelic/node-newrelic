/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../../lib/agent_helper')
const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')
const SegmentSynthesizer = require('../../../../lib/otel/segment-synthesis')
const createMockLogger = require('../../mocks/logger')
const {
  createDbClientSpan,
  createSpan,
  createHttpClientSpan,
  createDbStatementSpan,
  createMongoDbSpan,
  createRedisDbSpan,
  createMemcachedDbSpan
} = require('./fixtures')
const { SEMATTRS_HTTP_METHOD, SEMATTRS_DB_SYSTEM } = require('@opentelemetry/semantic-conventions')
const { SpanKind } = require('@opentelemetry/api')

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
    const segment = synthesizer.synthesize(span)
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
    const segment = synthesizer.synthesize(span)
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
    const segment = synthesizer.synthesize(span)
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
    const segment = synthesizer.synthesize(span)
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
    const segment = synthesizer.synthesize(span)
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
    const segment = synthesizer.synthesize(span)
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
    span.setAttribute(SEMATTRS_DB_SYSTEM, 'test-db')

    const segment = synthesizer.synthesize(span)
    assert.equal(segment.name, 'Datastore/statement/test-db/Unknown/Unknown')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should log warning when span does not have a synthesis rule', (t, end) => {
  const { agent, synthesizer, loggerMock, parentId, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createSpan({ name: 'test-span', kind: SpanKind.SERVER, parentId, tx, tracer })
    span.setAttribute(SEMATTRS_HTTP_METHOD, 'get')
    const segment = synthesizer.synthesize(span)
    assert.ok(!segment)
    assert.deepEqual(loggerMock.debug.args[0], [
      'Found type: %s, no synthesis rule currently built',
      'server'
    ])
    tx.end()
    end()
  })
})

test('should log warning span does not match a rule', (t, end) => {
  const { agent, synthesizer, loggerMock, parentId, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const span = createSpan({ name: 'test-span', kind: 'bogus', parentId, tx, tracer })
    const segment = synthesizer.synthesize(span)
    assert.ok(!segment)
    assert.deepEqual(loggerMock.debug.args[0], [
      'Cannot match a rule to span name: %s, kind %s',
      'test-span',
      'bogus'
    ])
    tx.end()
    end()
  })
})
