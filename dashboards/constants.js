/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const INSTRUMENTED_LIBRARIES = [
  '@apollo/gateway',
  '@apollo/server',
  '@aws-sdk/client-bedrock-runtime',
  '@aws-sdk/client-dynamodb',
  '@aws-sdk/client-sns',
  '@aws-sdk/client-sqs',
  '@aws-sdk/lib-dynamodb',
  '@aws-sdk/smithy-client',
  '@elastic/elasticsearch',
  '@grpc/grpc-js',
  '@hapi/hapi',
  '@hapi/vision',
  '@koa/router',
  '@langchain/core',
  '@nestjs/cli',
  '@nestjs/core',
  '@node-redis/client',
  '@prisma/client',
  '@redis/client',
  '@smithy/smithy-client',
  'amqplib',
  'apollo-server',
  'apollo-server-express',
  'apollo-server-fastify',
  'apollo-server-hapi',
  'apollo-server-koa',
  'apollo-server-lambda',
  'aws-sdk',
  'bluebird',
  'bunyan',
  'cassandra-driver',
  'connect',
  'director',
  'express',
  'fastify',
  'generic-pool',
  'ioredis',
  'kafkajs',
  'koa',
  'koa-route',
  'koa-router',
  'memcached',
  'mongodb',
  'mysql',
  'mysql2',
  'next',
  'openai',
  'pg',
  'pg-native',
  'pino',
  'q',
  'redis',
  'restify',
  'superagent',
  'undici',
  'when',
  'winston'
]
const MIN_NODE_VERSION = 16

module.exports = {
  INSTRUMENTED_LIBRARIES,
  MIN_NODE_VERSION
}
