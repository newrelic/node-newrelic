'use strict'

var path = require('path')
var test = require('tap').test
var request = require('request')
var helper = require('../../lib/agent_helper.js')
var skip = require('./skip')

test("Express 4 router introspection", {skip: skip()}, function (t) {
  t.plan(12)

  var agent = helper.instrumentMockedAgent()
  var express = require('express')
  var app = express()
  var server = require('http').createServer(app)


  this.tearDown(function cb_tearDown() {
    server.close(function cb_close() {
      helper.unloadAgent(agent)
    })
  })

  // need to capture parameters
  agent.config.capture_params = true

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Expressjs/GET//test/:id',
            "transaction has expected name")
    t.equal(transaction.url, '/test/31337', "URL is left alone")
    t.equal(transaction.statusCode, 200, "status code is OK")
    t.equal(transaction.verb, 'GET', "HTTP method is GET")
    t.ok(transaction.trace, "transaction has trace")

    var web = transaction.trace.root.children[0]
    t.ok(web, "trace has web segment")
    t.equal(web.name, transaction.name, "segment name and transaction name match")
    t.equal(web.partialName, 'Expressjs/GET//test/:id',
            "should have partial name for apdex")
    t.equal(web.parameters.id, '31337', "namer gets parameters out of route")
  })

  app.get('/test/:id', function (req, res) {
    t.ok(agent.getTransaction(), "transaction is available")

    res.send({status : 'ok'})
    res.end()
  })

  server.listen(8089, function () {
    request.get('http://localhost:8089/test/31337',
                {json : true},
                function (error, res, body) {

      t.equal(res.statusCode, 200, "nothing exploded")
      t.deepEqual(body, {status : 'ok'}, "got expected response")
    })
  })
})
