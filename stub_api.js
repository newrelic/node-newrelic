'use strict'

var path    = require('path')
  , logger  = require('./lib/logger.js')
  , RealAPI = require('./api.js')


function stubFunction (name) {
  // jshint -W061
  return eval("(function () {return function " + name + "() {" +
              "logger.debug('Not calling " + name + " because New Relic is disabled.');" +
              "}}())")
}

function Stub() {}

var keys   = Object.keys(RealAPI.prototype)
  , length = keys.length


/* This way the stub API doesn't have to be updated in lockstep with the regular
 * API.
 */
for (var i = 0; i < length; i++) {
  var name = keys[i]
  Stub.prototype[name] = stubFunction(name)
}

// this code gets injected into HTML templates
// and we don't want it to return undefined/null
Stub.prototype.getBrowserTimingHeader = function getBrowserTimingHeader(){
  logger.debug('Not calling getBrowserTimingHeader because New Relic is disabled.')
  return ''
}

// Normally the follow 3 calls return a wrapped callback, instead we should just
// return the callback in its unwrapped state.
Stub.prototype.createTracer = function(name, callback) {
  logger.debug('Not calling createTracer because New Relic is disabled.')
  return callback
}

Stub.prototype.createWebTransaction = function(url, callback) {
  logger.debug('Not calling createWebTransaction because New Relic is disabled.')
  return callback
}

Stub.prototype.createBackgroundTransaction = function(name, callback) {
  logger.debug('Not calling createBackgroundTransaction because New Relic is disabled.')
  return callback
}

module.exports = Stub
