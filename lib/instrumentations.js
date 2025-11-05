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
    '@grpc/grpc-js': { module: './instrumentation/grpc-js' },
    '@hapi/hapi': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    '@hapi/vision': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    '@nestjs/core': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    '@node-redis/client': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    '@prisma/client': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    '@redis/client': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    'aws-sdk': { module: './instrumentation/aws-sdk' },
    bluebird: { type: InstrumentationDescriptor.TYPE_PROMISE },
    connect: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    fastify: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    'generic-pool': { type: InstrumentationDescriptor.TYPE_GENERIC },
    kafkajs: { type: InstrumentationDescriptor.TYPE_MESSAGE },
    koa: { module: './instrumentation/koa' },
    memcached: { type: InstrumentationDescriptor.TYPE_DATASTORE },
    mongodb: { type: InstrumentationDescriptor.TYPE_DATASTORE },
    next: { module: './instrumentation/nextjs' },
    q: { type: null },
    redis: { type: InstrumentationDescriptor.TYPE_DATASTORE },
    restify: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    superagent: { type: InstrumentationDescriptor.TYPE_GENERIC },
    when: { module: './instrumentation/when' },
    winston: { type: InstrumentationDescriptor.TYPE_GENERIC }
  }
}
