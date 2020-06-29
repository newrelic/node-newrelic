/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')


test("Express router introspection", function(t) {
  t.plan(11)

  const agent = helper.instrumentMockedAgent()

  var express = require('express')
  var app = express()
  var server  = require('http').createServer(app)

  t.tearDown(function cb_tearDown() {
    server.close(function cb_close() {
      helper.unloadAgent(agent)
    })
  })

  // need to capture parameters
  agent.config.attributes.enabled = true

  agent.on('transactionFinished', function(transaction) {
    t.equal(
      transaction.name,
      'WebTransaction/Expressjs/GET//test',
      "transaction has expected name"
    )

    t.equal(transaction.url, '/test', "URL is left alone")
    t.equal(transaction.statusCode, 200, "status code is OK")
    t.equal(transaction.verb, 'GET', "HTTP method is GET")
    t.ok(transaction.trace, "transaction has trace")

    var web = transaction.trace.root.children[0]
    t.ok(web, "trace has web segment")
    t.equal(web.name, transaction.name, "segment name and transaction name match")

    t.equal(
      web.partialName,
      'Expressjs/GET//test',
      "should have partial name for apdex"
    )
  })

  app.get('/test', function(req, res) {
    t.ok(agent.getTransaction(), "transaction is available")

    res.send({status : 'ok'})
    res.end()
  })

  helper.randomPort(function(port) {
    server.listen(port, function() {
      var url = 'http://localhost:' + port + '/test'
      helper.makeGetRequest(url, {json : true}, function(error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected response")
      })
    })
  })
})
