/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  kafka_host: process.env.NR_NODE_TEST_KAFKA_HOST || '127.0.0.1',
  kafka_port: process.env.NR_NODE_TEST_KAFKA_PORT || 9092,

  memcached_host: process.env.NR_NODE_TEST_MEMCACHED_HOST || 'localhost',
  memcached_port: process.env.NR_NODE_TEST_MEMCACHED_PORT || 11211,

  mongodb_host: process.env.NR_NODE_TEST_MONGODB_HOST || 'localhost',
  mongodb_port: process.env.NR_NODE_TEST_MONGODB_PORT || 27017,

  mysql_host: process.env.NR_NODE_TEST_MYSQL_HOST || 'localhost',
  mysql_port: process.env.NR_NODE_TEST_MYSQL_PORT || 3306,

  redis_host: process.env.NR_NODE_TEST_REDIS_HOST || 'localhost',
  redis_port: process.env.NR_NODE_TEST_REDIS_PORT || 6379,
  redis_tls_host: process.env.NR_NODE_TEST_REDIS_TLS_HOST || '127.0.0.1',
  redis_tls_port: process.env.NR_NODE_TEST_REDIS_TLS_PORT || 6380,

  cassandra_host: process.env.NR_NODE_TEST_CASSANDRA_HOST || 'localhost',
  cassandra_port: process.env.NR_NODE_TEST_CASSANDRA_PORT || 9042,

  elastic_host: process.env.NR_NODE_TEST_ELASTIC_HOST || 'localhost',
  elastic_port: process.env.NR_NODE_TEST_ELASTIC_PORT || 9200,

  postgres_host: process.env.NR_NODE_TEST_POSTGRES_HOST || 'localhost',
  postgres_port: process.env.NR_NODE_TEST_POSTGRES_PORT || 5432,
  postgres_prisma_port: process.env.NR_NODE_TEST_POSTGRES_PRISMA_PORT || 5434,
  postgres_user: process.env.NR_NODE_TEST_POSTGRES_USER || 'postgres',
  postgres_pass: process.env.NR_NODE_TEST_POSTGRES_PASS,
  postgres_db: process.env.NR_NODE_TEST_POSTGRES_DB || 'postgres',

  rabbitmq_host: process.env.NR_NODE_TEST_RABBIT_HOST || 'localhost',
  rabbitmq_port: process.env.NR_NODE_TEST_RABBIT_PORT || 5672
}
