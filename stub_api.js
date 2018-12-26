'use strict'

var logger = require('./lib/logger.js')
var RealAPI = require('./api.js')
var TransactionHandle = require('./lib/transaction/handle')


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

Stub.prototype.startSegment = startSegment
Stub.prototype.startWebTransaction = startWebTransaction
Stub.prototype.startBackgroundTransaction = startBackgroundTransaction
Stub.prototype.getTransaction = getTransaction
Stub.prototype.getBrowserTimingHeader = getBrowserTimingHeader
Stub.prototype.shutdown = shutdown
Stub.prototype.setLambdaHandler = setLambdaHandler

// This code gets injected into HTML templates
// and we don't want it to return undefined/null.
function getBrowserTimingHeader() {
  logger.debug('Not calling getBrowserTimingHeader because New Relic is disabled.')
  return ''
}

function getTransaction() {
  return new TransactionHandle.Stub()
}

function setLambdaHandler(callback) {
  logger.debug('Not calling setLambdaHandler because New Relic is disabled.')
  return callback
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
