'use strict'

var tap     = require('tap')
var test    = tap.test
var request = require('request')
var helper  = require('../../lib/agent_helper')
var semver = require('semver')


test("agent instrumentation of restify shouldn't affect express query parsing middleware",
  {skip: semver.satisfies(process.version, '>=7.0.0')},
  function(t) {
  t.plan(2)

  var agent   = helper.instrumentMockedAgent()
  var express = require('express')
  var restify = require('restify')
  var app     = express()
  var server  = require('http').createServer(app)


  app.get('/', function cb_get(req, res) {
    t.deepEqual(req.query, {test: 'success'}, 'express req.query property is correct')
    res.sendStatus(200)
  })
  server.listen(8765)

  request.get('http://localhost:8765/?test=success', function(err, response) {
    if (err) return t.fail(err)
    t.equal(200, response.statusCode)
  })

  t.tearDown(function cb_tearDown() {
    server.close()
    helper.unloadAgent(agent)
  })
})
