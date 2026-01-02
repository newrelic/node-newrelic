/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  createDbSpan,
  createDbClientSpan,
  createMemcachedDbSpan,
  createMongoDbSpan,
  createRedisDbSpan
} = require('./db-sql')
const createSpan = require('./span')
const createHttpClientSpan = require('./http-client')
const {
  createFallbackServer,
  createRpcServerSpan,
  createHttpServerSpan,
  createHttpServer1dot23Span
} = require('./server')
const { createProducerSpan } = require('./producer')
const { createConsumerSpan } = require('./consumer')

module.exports = {
  createConsumerSpan,
  createDbSpan,
  createDbClientSpan,
  createFallbackServer,
  createHttpClientSpan,
  createHttpServerSpan,
  createHttpServer1dot23Span,
  createMemcachedDbSpan,
  createMongoDbSpan,
  createRedisDbSpan,
  createRpcServerSpan,
  createSpan,
  createProducerSpan
}
