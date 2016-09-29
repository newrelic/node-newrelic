'use strict'

var path = require('path')
var test = require('tap').test
var helper = require('../../lib/agent_helper.js')
var skip = require('./skip')

test("Express 4 detection", {skip: skip()}, function (t) {
  var agent   = helper.instrumentMockedAgent()
  var express = require('express')

  this.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })

  // Check if process_params is wrapped as it is the only exclusively
  // express 4 chunk that we wrap.
  t.ok(express.Router.process_params.__NR_unwrap)
  t.end()
})
