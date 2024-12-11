/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  createDbClientSpan,
  createDbStatementSpan,
  createMemcachedDbSpan,
  createMongoDbSpan,
  createRedisDbSpan
} = require('./db-sql')
const createSpan = require('./span')
const createHttpClientSpan = require('./http-client')
const { createRpcServerSpan, createHttpServerSpan, createBaseHttpSpan } = require('./server')

module.exports = {
  createBaseHttpSpan,
  createDbClientSpan,
  createDbStatementSpan,
  createHttpClientSpan,
  createHttpServerSpan,
  createMemcachedDbSpan,
  createMongoDbSpan,
  createRedisDbSpan,
  createRpcServerSpan,
  createSpan
}
