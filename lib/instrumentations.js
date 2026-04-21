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
    '@hapi/hapi': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    '@hapi/vision': { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    '@prisma/client': { type: InstrumentationDescriptor.TYPE_DATASTORE },
    'aws-sdk': { module: './instrumentation/aws-sdk' },
    fastify: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK },
    kafkajs: { type: InstrumentationDescriptor.TYPE_MESSAGE },
    koa: { module: './instrumentation/koa' },
    mongodb: { type: InstrumentationDescriptor.TYPE_DATASTORE },
    next: { module: './instrumentation/nextjs' },
    restify: { type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK }
  }
}
