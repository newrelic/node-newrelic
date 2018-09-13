'use strict'

var MODULE_TYPE = require('./shim/constants').MODULE_TYPE

// Return a new copy of this array every time we're called
module.exports = function instrumentations() {
  return {
    'amqplib': {type: MODULE_TYPE.MESSAGE},
    'cassandra-driver': {type: MODULE_TYPE.DATASTORE},
    'connect': {type: MODULE_TYPE.WEB_FRAMEWORK},
    'bluebird': {type: MODULE_TYPE.PROMISE},
    'director': {type: MODULE_TYPE.WEB_FRAMEWORK},
    'express': {type: MODULE_TYPE.WEB_FRAMEWORK},
    'generic-pool': {type: MODULE_TYPE.GENERIC},
    'hapi': {type: MODULE_TYPE.WEB_FRAMEWORK},
    'ioredis': {type: MODULE_TYPE.DATASTORE},
    'koa': {module: '@newrelic/koa'},
    'memcached': {type: MODULE_TYPE.DATASTORE},
    'mongodb': {type: MODULE_TYPE.DATASTORE},
    'mysql': {type: MODULE_TYPE.DATASTORE},
    'node-cassandra-cql': {type: MODULE_TYPE.DATASTORE},
    'pg': {type: MODULE_TYPE.DATASTORE},
    'q': {type: null},
    'redis': {type: MODULE_TYPE.DATASTORE},
    'restify': {type: MODULE_TYPE.WEB_FRAMEWORK},
    'superagent': {module: '@newrelic/superagent'},
    'oracle': {type: null},
    'vision': {type: MODULE_TYPE.WEB_FRAMEWORK},
    'when': {type: null}
  }
}
