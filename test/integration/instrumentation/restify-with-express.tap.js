'use strict'

const tap     = require('tap')
const test    = tap.test
const request = require('request')
const helper  = require('../../lib/agent_helper')

test(
  "agent instrumentation of restify shouldn't affect express query parsing middleware",
  function(t) {
    t.plan(2)

    const agent   = helper.instrumentMockedAgent()
    const express = require('express')

    require('restify')

    const app     = express()
    const server  = require('http').createServer(app)


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
  }
)
