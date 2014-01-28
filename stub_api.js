'use strict';

var path    = require('path')
  , logger  = require(path.join(__dirname, 'lib', 'logger.js'))
  , RealAPI = require(path.join(__dirname, 'api.js'))
  ;

function stubFunction (name) {
  // jshint -W061
  return eval("(function () {return function " + name + "() {" +
              "logger.debug('Not calling " + name + " because New Relic is disabled.');" +
              "}}())");
}

function Stub() {}

var keys   = Object.keys(RealAPI.prototype)
  , length = keys.length
  ;

/* This way the stub API doesn't have to be updated in lockstep with the regular
 * API.
 */
for (var i = 0; i < length; i++) {
  var name = keys[i];
  Stub.prototype[name] = stubFunction(name);
}

// this code gets injected into HTML templates
// and we don't want it to return undefined/null
Stub.prototype.getBrowserTimingHeader = function (){
  logger.debug('Not calling getBrowserTimingHeader because New Relic is disabled.');
  return '';
};

module.exports = Stub;
