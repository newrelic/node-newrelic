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
const { createRpcServerSpan, createHttpServerSpan } = require('./server')
const { createProducerSpan } = require('./producer')
const { createConsumerSpan } = require('./consumer')

module.exports = {
  createConsumerSpan,
  createDbSpan,
  createDbClientSpan,
  createHttpClientSpan,
  createHttpServerSpan,
  createMemcachedDbSpan,
  createMongoDbSpan,
  createRedisDbSpan,
  createRpcServerSpan,
  createSpan,
  createProducerSpan
}
