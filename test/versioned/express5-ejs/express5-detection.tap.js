'use strict'

var path = require('path')
var test = require('tap').test
var helper = require('../../lib/agent_helper.js')

test("Express 5 detection", function (t) {
  var agent = helper.instrumentMockedAgent({express5: true})
  var express = require('express')

  this.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })

  // Check if process_params is wrapped as it is the only exclusively
  // express 5 chunk that we wrap.
  t.ok(express.Router.prototype.process_params.__NR_unwrap)
  t.end()

})
