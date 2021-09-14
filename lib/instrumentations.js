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
    'director': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'express': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'fastify': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'generic-pool': { type: MODULE_TYPE.GENERIC },
    '@hapi/hapi': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'hapi': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'ioredis': { type: MODULE_TYPE.DATASTORE },
    'koa': { module: '@newrelic/koa' },
    'memcached': { type: MODULE_TYPE.DATASTORE },
    'mongodb': { type: MODULE_TYPE.DATASTORE },
    'mysql': { type: MODULE_TYPE.DATASTORE },
    'pg': { type: MODULE_TYPE.DATASTORE },
    'q': { type: null },
    'redis': { type: MODULE_TYPE.DATASTORE },
    'restify': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'superagent': { module: '@newrelic/superagent' },
    'undici': { type: MODULE_TYPE.TRANSACTION },
    'oracle': { type: null },
    'vision': { type: MODULE_TYPE.WEB_FRAMEWORK },
    'when': { type: null }
  }
}
