/**
 * This test checks for regressions on the route stack manipulation for Express apps.
 */
'use strict'

var test = require('tap').test
var request = require('request')
var helper = require('../../lib/agent_helper.js')
var skip = require('./skip')

test("Express 4 + express-enrouten compatibility test", {skip: skip()}, function (t) {
  t.plan(2)

  var agent = helper.instrumentMockedAgent()
  var express = require('express')
  var enrouten = require('express-enrouten')
  var app = express()
  var server = require('http').createServer(app)

  app.use(enrouten({directory: './fixtures'}));

  this.tearDown(function cb_tearDown() {
    server.close(function cb_close() {
      helper.unloadAgent(agent)
    })
  })

  //New Relic + express-enrouten used to have a bug, where any routes after the first one would be lost.
  server.listen(8089, function () {
    request.get('http://localhost:8089/', function (error, res, body) {
      t.equal(res.statusCode, 200, 'First Route loaded')
    })

    request.get('http://localhost:8089/foo', function (error, res, body) {
      t.equal(res.statusCode, 200, 'Second Route loaded')
    })
  })
})
