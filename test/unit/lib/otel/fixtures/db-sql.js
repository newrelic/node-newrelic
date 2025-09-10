/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { SpanKind } = require('@opentelemetry/api')
const createSpan = require('./span')

const {
  ATTR_NET_PEER_NAME,
  ATTR_NET_PEER_PORT,
  ATTR_MONGODB_COLLECTION,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_DB_OPERATION,
  ATTR_DB_STATEMENT,
  ATTR_DB_SYSTEM,
  DB_SYSTEM_VALUES
} = require('#agentlib/otel/traces/constants.js')

/**
 *
 * @param root0
 * @param root0.tracer
 * @param root0.name
 */
function createDbClientSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, tracer })
  span.setAttribute(ATTR_DB_SYSTEM, 'custom-db')
  span.setAttribute(ATTR_SERVER_ADDRESS, 'db.example.com')
  span.setAttribute(ATTR_SERVER_PORT, '1234')
  span.setAttribute(ATTR_DB_STATEMENT, 'select * from test-table')
  return span
}

/**
 *
 * @param root0
 * @param root0.tracer
 * @param root0.name
 */
function createDbSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, tracer })
  span.setAttribute(ATTR_DB_SYSTEM, 'custom-db')
  span.setAttribute(ATTR_NET_PEER_NAME, 'db.example.com')
  span.setAttribute(ATTR_NET_PEER_PORT, '1234')
  return span
}

/**
 *
 * @param root0
 * @param root0.tracer
 * @param root0.name
 */
function createMemcachedDbSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, tracer })
  span.setAttribute(ATTR_DB_SYSTEM, DB_SYSTEM_VALUES.MEMCACHED)
  span.setAttribute(ATTR_SERVER_ADDRESS, 'memcached.example.com')
  span.setAttribute(ATTR_SERVER_PORT, '11211')
  span.setAttribute(ATTR_DB_STATEMENT, 'set foo 1')
  return span
}

/**
 *
 * @param root0
 * @param root0.tracer
 * @param root0.name
 */
function createMongoDbSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, tracer })
  span.setAttribute(ATTR_DB_SYSTEM, DB_SYSTEM_VALUES.MONGODB)
  span.setAttribute(ATTR_DB_OPERATION, 'insert')
  span.setAttribute(ATTR_MONGODB_COLLECTION, 'test-collection')
  span.setAttribute(ATTR_NET_PEER_NAME, 'mongo.example.com')
  span.setAttribute(ATTR_NET_PEER_PORT, '27017')
  return span
}

/**
 *
 * @param root0
 * @param root0.tracer
 * @param root0.name
 */
function createRedisDbSpan({ tracer, name = 'test-span' }) {
  const span = createSpan({ name, kind: SpanKind.CLIENT, tracer })
  span.setAttribute(ATTR_DB_SYSTEM, DB_SYSTEM_VALUES.REDIS)
  span.setAttribute(ATTR_DB_STATEMENT, 'hset hash random random')
  span.setAttribute(ATTR_SERVER_ADDRESS, 'redis.example.com')
  span.setAttribute(ATTR_SERVER_PORT, '6379')
  return span
}

module.exports = {
  createDbSpan,
  createDbClientSpan,
  createMemcachedDbSpan,
  createMongoDbSpan,
  createRedisDbSpan
}
