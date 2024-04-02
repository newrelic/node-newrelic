/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const InstrumentationDescriptor = require('./instrumentation-descriptor')

// Return a new copy of this array every time we're called
module.exports = function instrumentations() {
  return {
    'aws-sdk': { module: '@newrelic/aws-sdk' },
    'amqplib': { module: './instrumentation/amqplib' },
    'cassandra-driver': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    'connect': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    'bluebird': { type: InstrumentationDescriptor.TYPE_PROMISE },
    'bunyan': { type: InstrumentationDescriptor.TYPE_GENERIC },
    'director': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    '@elastic/elasticsearch': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    'express': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    'fastify': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    'generic-pool': { type: InstrumentationDescriptor.TYPE_GENERIC },
    '@grpc/grpc-js': { module: './instrumentation/grpc-js' },
    '@hapi/hapi': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    'ioredis': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    'koa': { module: '@newrelic/koa' },
    'langchain': { module: './instrumentation/langchain' },
    'memcached': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    'mongodb': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    'mysql': { module: './instrumentation/mysql' },
    'openai': { type: InstrumentationDescriptor.TYPE_GENERIC },
    '@nestjs/core': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    '@prisma/client': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    'pino': { module: './instrumentation/pino' },
    'pg': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    'q': { type: null },
    'redis': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    '@node-redis/client': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    '@redis/client': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    'restify': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    'superagent': { module: '@newrelic/superagent' },
    '@hapi/vision': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    'when': { module: './instrumentation/when' },
    'winston': { type: InstrumentationDescriptor.TYPE_GENERIC },
    /**
     * The modules below are listed here purely to take
     * advantage of the Supportability/Features/onRequire/<module>
     * metrics for libraries we want to track for some reason or another.
     * The big uses cases are:
     *  Logging libraries we want to instrument in the future
     *  Libraries that have OpenTelemetry instrumentation we want to register
     *  or have already registered.
     */
    'loglevel': { type: InstrumentationDescriptor.TYPE_TRACKING },
    'npmlog': { type: InstrumentationDescriptor.TYPE_TRACKING },
    'fancy-log': { type: InstrumentationDescriptor.TYPE_TRACKING },
    'knex': { type: InstrumentationDescriptor.TYPE_TRACKING },
    '@azure/openai': { type: InstrumentationDescriptor.TYPE_TRACKING },
    '@langchain/community/llms/bedrock': { type: InstrumentationDescriptor.TYPE_TRACKING }
  }
}
