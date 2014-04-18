'use strict';

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper.js'))
  , API     = require(path.join(__dirname, '..', '..', '..', 'api.js'))
  ;
/*
 *
 * CONSTANTS
 *
 */

test("Express 4 detection", function (t) {
  var agent   = helper.instrumentMockedAgent()
    , express = require('express')
    ;

  this.tearDown(function () {
    helper.unloadAgent(agent);
  });

  // Check if process_params is wrapped as it is the only exclusively
  // express 4 chunk that we wrap.
  t.ok(express.Router.process_params.__NR_unwrap);
  t.end()

});