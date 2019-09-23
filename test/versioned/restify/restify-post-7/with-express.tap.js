'use strict'

const tap = require('tap')
const request = require('request')
const helper  = require('../../../lib/agent_helper')

tap.test("restify shouldn't affect express query parsing middleware", function(t) {
  t.plan(2)

  const agent = helper.instrumentMockedAgent()
  const express = require('express')

  require('restify')

  const app     = express()
  const server  = require('http').createServer(app)

  app.get('/', function cb_get(req, res) {
    // Unforunately, restify has its own issues with Express right now
    // and by modify the prototype ends up chaning query from a property
    // to a function. So we'll double-check the value but express is already borked.
    // https://github.com/restify/node-restify/issues/1540
    // https://github.com/restify/node-restify/blob/master/lib/request.js#L382-L398
    let query = null
    if (req.query && typeof req.query === 'function') {
      query = req.query()
    }

    // The restify function replacement mentioned above also results
    // in a string instead of an object.
    t.deepEqual(query, 'test=success', 'express req.query property is correct')
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
