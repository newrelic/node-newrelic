/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MODULE_TYPE = require('./shim/constants').MODULE_TYPE

// Return a new copy of this array every time we're called
module.exports = function instrumentations() {
  return {
    'aws-sdk': { module: '@newrelic/aws-sdk' },
    'amqplib': { type: MODULE_TYPE.MESSAGE },
    'cassandra-driver': { type: MODULE_TYPE.DATASTORE },
    'connect': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'bluebird': { type: MODULE_TYPE.PROMISE },
    'bunyan': { type: MODULE_TYPE.GENERIC },
    'director': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'express': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'fastify': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'generic-pool': { type: MODULE_TYPE.GENERIC },
    '@grpc/grpc-js': { module: './instrumentation/grpc-js' },
    '@hapi/hapi': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'ioredis': { type: MODULE_TYPE.DATASTORE },
    'koa': { module: '@newrelic/koa' },
    'memcached': { type: MODULE_TYPE.DATASTORE },
    'mongodb': { type: MODULE_TYPE.DATASTORE },
    'mysql': { module: './instrumentation/mysql' },
    'pino': { module: './instrumentation/pino' },
    'pg': { type: MODULE_TYPE.DATASTORE },
    'q': { type: null },
    'redis': { type: MODULE_TYPE.DATASTORE },
    '@node-redis/client': { type: MODULE_TYPE.DATASTORE },
    '@redis/client': { type: MODULE_TYPE.DATASTORE },
    'restify': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'superagent': { module: '@newrelic/superagent' },
    'undici': { type: MODULE_TYPE.TRANSACTION },
    '@hapi/vision': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'when': { module: './instrumentation/when' },
    'winston': { type: MODULE_TYPE.GENERIC },
    /**
     * The modules below are listed here purely to take
     * advantage of the Supportability/Features/onRequire/<module>
     * metrics for libraries we want to track for some reason or another.
     * The big uses cases are:
     *  Logging libraries we want to instrument in the future
     *  Libraries that have OpenTelemetry instrumentation we want to register
     *  or have already registered.
     */
    'loglevel': { type: MODULE_TYPE.TRACKING },
    'npmlog': { type: MODULE_TYPE.TRACKING },
    'fancy-log': { type: MODULE_TYPE.TRACKING },
    '@prisma/client': { type: MODULE_TYPE.TRACKING },
    '@nestjs/core': { type: MODULE_TYPE.TRACKING },
    'knex': { type: MODULE_TYPE.TRACKING }
  }
}
