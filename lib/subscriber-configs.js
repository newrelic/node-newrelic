/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// The expected export of these files is:
// 'package-name': [ { path: 'subscriberPath', instrumentations: [] }, ... ]
const subscribers = {
  ...require('./subscribers/amqplib/config'),
  ...require('./subscribers/bunyan/config'),
  ...require('./subscribers/cassandra-driver/config'),
  ...require('./subscribers/elasticsearch/config'),
  ...require('./subscribers/express/config'),
  ...require('./subscribers/fastify/config'),
  ...require('./subscribers/google-genai/config'),
  ...require('./subscribers/grpcjs/config'),
  ...require('./subscribers/ioredis/config'),
  ...require('./subscribers/iovalkey/config'),
  ...require('./subscribers/langchain/config'),
  ...require('./subscribers/langgraph/config'),
  ...require('./subscribers/mcp-sdk/config'),
  ...require('./subscribers/mysql/config'),
  ...require('./subscribers/mysql2/config'),
  ...require('./subscribers/nestjs/config'),
  ...require('./subscribers/node-redis-client/config'),
  ...require('./subscribers/openai/config'),
  ...require('./subscribers/pg/config'),
  ...require('./subscribers/pino/config'),
  ...require('./subscribers/redis/config'),
  ...require('./subscribers/redis-client/config'),
  ...require('./subscribers/undici/config'),
  ...require('./subscribers/winston/config')
}

module.exports = subscribers
