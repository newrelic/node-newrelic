'use strict'

var logger = require('./lib/logger.js')
var RealAPI = require('./api.js')
var TransactionHandle = require('./lib/transaction/handle')
var util = require('util')


/* eslint-disable no-eval */
function stubFunction(name) {
  return eval(
    "(function () {return function " + name + "() {" +
    "logger.debug('Not calling " + name + " because New Relic is disabled.');" +
    "}}())"
  )
}
/* eslint-enable no-eval */

function Stub() {}

var keys = Object.keys(RealAPI.prototype)
var length = keys.length


/* This way the stub API doesn't have to be updated in lockstep with the regular
 * API.
 */
for (var i = 0; i < length; i++) {
  var functionName = keys[i]
  Stub.prototype[functionName] = stubFunction(functionName)
}

Stub.prototype.createTracer = util.deprecate(
  createTracer, [
    'API#createTracer is being deprecated!',
    'Please use API#startSegment for segment creation.'
  ].join(' ')
)
Stub.prototype.createWebTransaction = util.deprecate(
  createWebTransaction, [
    'API#createWebTransaction is being deprecated!',
    'Please use API#startWebTransaction for transaction creation',
    'and API#getTransaction for transaction management including',
    'ending transactions.'
  ].join(' ')
)
Stub.prototype.createBackgroundTransaction = util.deprecate(
  createBackgroundTransaction, [
    'API#createBackgroundTransaction is being deprecated!',
    'Please use API#startBackgroundTransaction for transaction creation',
    'and API#getTransaction for transaction management including',
    'ending transactions.'
  ].join(' ')
)
Stub.prototype.startSegment = startSegment
Stub.prototype.startWebTransaction = startWebTransaction
Stub.prototype.startBackgroundTransaction = startBackgroundTransaction
Stub.prototype.getTransaction = getTransaction
Stub.prototype.getBrowserTimingHeader = getBrowserTimingHeader
Stub.prototype.shutdown = shutdown

// This code gets injected into HTML templates
// and we don't want it to return undefined/null.
function getBrowserTimingHeader() {
  logger.debug('Not calling getBrowserTimingHeader because New Relic is disabled.')
  return ''
}

function getTransaction() {
  return new TransactionHandle.Stub()
}

// Normally the following 3 calls return a wrapped callback, instead we
// should just return the callback in its unwrapped state.
function createTracer(name, callback) {
  logger.debug('Not calling createTracer because New Relic is disabled.')
  return callback
}

function createWebTransaction(url, callback) {
  logger.debug('Not calling createWebTransaction because New Relic is disabled.')
  return callback
}

function createBackgroundTransaction(name, group, callback) {
  logger.debug('Not calling createBackgroundTransaction because New Relic is disabled.')
  return (callback === undefined) ? group : callback
}

function startSegment(name, record, handler, callback) {
  logger.debug('Not calling `startSegment` becuase New Relic is disabled.')
  if (typeof handler === 'function') {
    return handler(callback)
  }
  return null
}

function startWebTransaction(url, callback) {
  logger.debug('Not calling startWebTransaction because New Relic is disabled.')
  if (typeof callback === 'function') {
    return callback()
  }

  return null
}

function startBackgroundTransaction(name, group, callback) {
  logger.debug('Not calling startBackgroundTransaction because New Relic is disabled.')
  if (typeof callback === 'function') {
    return callback()
  }

  if (typeof group === 'function') {
    return group()
  }

  return null
}

// Normally the following call executes callback asynchronously
function shutdown(options, cb) {
  logger.debug('Not calling shutdown because New Relic is disabled.')

  var callback = cb
  if (!callback) {
    if (typeof options === 'function') {
      callback = options
    } else {
      callback = function __NR_defaultCb() {}
    }
  }

  setImmediate(callback)
}

module.exports = Stub
