/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const InstrumentationDescriptor = require('./instrumentation-descriptor')

// Return a new copy of this array every time we're called
module.exports = function instrumentations() {
  return {
    '@elastic/elasticsearch': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    '@opensearch-project/opensearch': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    '@grpc/grpc-js': { module: './instrumentation/grpc-js' },
    '@hapi/hapi': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    '@hapi/vision': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    '@nestjs/core': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    '@node-redis/client': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    '@prisma/client': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    '@redis/client': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    amqplib: { module: './instrumentation/amqplib' },
    'aws-sdk': { module: './instrumentation/aws-sdk' },
    bluebird: { type: InstrumentationDescriptor.TYPE_PROMISE },
    bunyan: { type: InstrumentationDescriptor.TYPE_GENERIC },
    'cassandra-driver': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    connect: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    express: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    fastify: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    'generic-pool': { type: InstrumentationDescriptor.TYPE_GENERIC },
    ioredis: { type: InstrumentationDescriptor.TYPE_DATASTORE },
    kafkajs: { type: InstrumentationDescriptor.TYPE_MESSAGE },
    koa: { module: './instrumentation/koa' },
    langchain: { module: './instrumentation/langchain' },
    memcached: { type: InstrumentationDescriptor.TYPE_DATASTORE },
    mongodb: { type: InstrumentationDescriptor.TYPE_DATASTORE },
    mysql: { module: './instrumentation/mysql' },
    next: { module: './instrumentation/nextjs' },
    openai: { type: InstrumentationDescriptor.TYPE_GENERIC },
    pg: { type: InstrumentationDescriptor.TYPE_DATASTORE },
    pino: { module: './instrumentation/pino' },
    q: { type: null },
    redis: { type: InstrumentationDescriptor.TYPE_DATASTORE },
    restify: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    superagent: { type: InstrumentationDescriptor.TYPE_GENERIC },
    when: { module: './instrumentation/when' },
    winston: { type: InstrumentationDescriptor.TYPE_GENERIC },

    /**
     * The modules below are listed here purely to take
     * advantage of the Supportability/Features/onRequire/<module>
     * metrics for libraries we want to track for some reason or another.
     * The big uses cases are:
     *  Logging libraries we want to instrument in the future
     *  Libraries that have OpenTelemetry instrumentation we want to register
     *  or have already registered.
     */
    '@azure/openai': { type: InstrumentationDescriptor.TYPE_TRACKING },
    '@langchain/community/llms/bedrock': { type: InstrumentationDescriptor.TYPE_TRACKING },
    'fancy-log': { type: InstrumentationDescriptor.TYPE_TRACKING },
    knex: { type: InstrumentationDescriptor.TYPE_TRACKING },
    loglevel: { type: InstrumentationDescriptor.TYPE_TRACKING },
    npmlog: { type: InstrumentationDescriptor.TYPE_TRACKING }
  }
}
