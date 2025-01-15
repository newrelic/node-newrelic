/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  SEMATTRS_DB_SYSTEM,
  SEMATTRS_DB_SQL_TABLE,
  SEMATTRS_DB_OPERATION,
  SEMATTRS_DB_STATEMENT,
  DbSystemValues,
  SEMATTRS_DB_MONGODB_COLLECTION
} = require('@opentelemetry/semantic-conventions')
const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')

function createDbClientSpan({ parentId, tracer, tx, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, parentId, tracer, tx })
  span.setAttribute(SEMATTRS_DB_SYSTEM, 'custom-db')
  span.setAttribute(SEMATTRS_DB_SQL_TABLE, 'test-table')
  span.setAttribute(SEMATTRS_DB_OPERATION, 'select')
  return span
}

function createDbStatementSpan({ parentId, tracer, tx, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, parentId, tracer, tx })
  span.setAttribute(SEMATTRS_DB_SYSTEM, 'custom-db')
  span.setAttribute(SEMATTRS_DB_STATEMENT, 'select * from test-table')
  return span
}

function createMemcachedDbSpan({ parentId, tracer, tx, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, parentId, tracer, tx })
  span.setAttribute(SEMATTRS_DB_SYSTEM, DbSystemValues.MEMCACHED)
  span.setAttribute(SEMATTRS_DB_OPERATION, 'set')
  return span
}

function createMongoDbSpan({ parentId, tracer, tx, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, parentId, tracer, tx })
  span.setAttribute(SEMATTRS_DB_SYSTEM, DbSystemValues.MONGODB)
  span.setAttribute(SEMATTRS_DB_OPERATION, 'insert')
  span.setAttribute(SEMATTRS_DB_MONGODB_COLLECTION, 'test-collection')
  return span
}

function createRedisDbSpan({ parentId, tracer, tx, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, parentId, tracer, tx })
  span.setAttribute(SEMATTRS_DB_SYSTEM, DbSystemValues.REDIS)
  span.setAttribute(SEMATTRS_DB_STATEMENT, 'hset hash random random')
  return span
}

module.exports = {
  createDbClientSpan,
  createDbStatementSpan,
  createMemcachedDbSpan,
  createMongoDbSpan,
  createRedisDbSpan
}
