'use strict'

var tap     = require('tap')
  , test    = tap.test
  , request = require('request')
  , helper  = require('../../lib/agent_helper')
  

test("agent instrumentation of restify shouldn't affect express query parsing middleware",
     function (t) {
  t.plan(2)

  var agent   = helper.instrumentMockedAgent()
    , express = require('express')
    , restify = require('restify')
    , app     = express()
    , server  = require('http').createServer(app)
    

  app.get('/', function cb_get(req, res) {
    t.deepEqual(req.query, {test: 'success'}, 'express req.query property is correct')
    res.send(200)
  })
  server.listen(8765)

  request.get('http://localhost:8765/?test=success', function cb_get(err, response, body) {
    if (err) return t.fail(err)
    t.equal(200, response.statusCode)
  })

  this.tearDown(function cb_tearDown() {
    server.close()
    helper.unloadAgent(agent)
  })
})
