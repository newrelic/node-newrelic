/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')

const {
  ATTR_MONGODB_COLLECTION,
  ATTR_DB_OPERATION,
  ATTR_DB_SQL_TABLE,
  ATTR_DB_STATEMENT,
  ATTR_DB_SYSTEM,
  DB_SYSTEM_VALUES
} = require('#agentlib/otel/constants.js')

function createDbClientSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, tracer })
  span.setAttribute(ATTR_DB_SYSTEM, 'custom-db')
  span.setAttribute(ATTR_DB_SQL_TABLE, 'test-table')
  span.setAttribute(ATTR_DB_OPERATION, 'select')
  return span
}

function createDbStatementSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, tracer })
  span.setAttribute(ATTR_DB_SYSTEM, 'custom-db')
  span.setAttribute(ATTR_DB_STATEMENT, 'select * from test-table')
  return span
}

function createMemcachedDbSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, tracer })
  span.setAttribute(ATTR_DB_SYSTEM, DB_SYSTEM_VALUES.MEMCACHED)
  span.setAttribute(ATTR_DB_OPERATION, 'set')
  return span
}

function createMongoDbSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, tracer })
  span.setAttribute(ATTR_DB_SYSTEM, DB_SYSTEM_VALUES.MONGODB)
  span.setAttribute(ATTR_DB_OPERATION, 'insert')
  span.setAttribute(ATTR_MONGODB_COLLECTION, 'test-collection')
  return span
}

function createRedisDbSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, tracer })
  span.setAttribute(ATTR_DB_SYSTEM, DB_SYSTEM_VALUES.REDIS)
  span.setAttribute(ATTR_DB_STATEMENT, 'hset hash random random')
  return span
}

module.exports = {
  createDbClientSpan,
  createDbStatementSpan,
  createMemcachedDbSpan,
  createMongoDbSpan,
  createRedisDbSpan
}
