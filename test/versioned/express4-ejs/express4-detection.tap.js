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

  // FLAG: express4
  agent.config.feature_flag.express4 = true;

  console.dir(express.Router.process_params);
  t.ok(express.Router.process_params.__NR_unwrap);
  t.end()

});