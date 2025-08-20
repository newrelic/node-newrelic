/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const InstrumentationDescriptor = require('./instrumentation-descriptor')

// Return a new copy of this array every time we're called
module.exports = function instrumentations() {
  return {
    '@azure/functions': { type: InstrumentationDescriptor.TYPE_GENERIC },
    '@google/genai': { type: InstrumentationDescriptor.TYPE_GENERIC },
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
    connect: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    express: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    fastify: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    'generic-pool': { type: InstrumentationDescriptor.TYPE_GENERIC },
    kafkajs: { type: InstrumentationDescriptor.TYPE_MESSAGE },
    koa: { module: './instrumentation/koa' },
    langchain: { module: './instrumentation/langchain' },
    memcached: { type: InstrumentationDescriptor.TYPE_DATASTORE },
    mongodb: { type: InstrumentationDescriptor.TYPE_DATASTORE },
    mysql: { module: './instrumentation/mysql' },
    next: { module: './instrumentation/nextjs' },
    openai: { type: InstrumentationDescriptor.TYPE_GENERIC },
    pg: { type: InstrumentationDescriptor.TYPE_DATASTORE },
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
    npmlog: { type: InstrumentationDescriptor.TYPE_TRACKING },

    /**
     * The modules below are listed here is a temporary solution to maintaining
     * the Supportability/Features/onRequire/<module> metrics for libraries
     * that have been migrated to use tracing chanel instrumentation.
     * Once orchestrion can emit the package version, these can be removed.
     * {@link https://github.com/newrelic/node-newrelic/issues/3308 Github Issue}
     */
    'cassandra-driver': { type: InstrumentationDescriptor.TYPE_TRACKING },
    '@elastic/elasticsearch': { type: InstrumentationDescriptor.TYPE_TRACKING },
    '@modelcontextprotocol/sdk/client/index.js': { type: InstrumentationDescriptor.TYPE_TRACKING },
    '@opensearch-project/opensearch': { type: InstrumentationDescriptor.TYPE_TRACKING },
    ioredis: { type: InstrumentationDescriptor.TYPE_TRACKING },
    pino: { type: InstrumentationDescriptor.TYPE_TRACKING }
  }
}
