'use strict'

var test = require('tap').test
var request = require('request')
var helper = require('../../lib/agent_helper.js')
var skip = require('./skip')

test("Express 4 router introspection", {skip: skip()}, function(t) {
  t.plan(14)

  var agent = helper.instrumentMockedAgent()
  var express = require('express')
  var app = express()
  var server = require('http').createServer(app)

  var router = express.Router() // eslint-disable-line new-cap
  router.get('/b/:param2', function(req, res) {
    t.ok(agent.getTransaction(), "transaction is available")

    res.send({status : 'ok'})
    res.end()
  })
  app.use('/a/:param1', router)

  t.tearDown(function cb_tearDown() {
    server.close(function cb_close() {
      helper.unloadAgent(agent)
    })
  })

  // need to capture parameters
  agent.config.capture_params = true

  agent.on('transactionFinished', function(transaction) {
    t.equal(transaction.name, 'WebTransaction/Expressjs/GET//a/:param1/b/:param2',
            "transaction has expected name")
    t.equal(transaction.url, '/a/foo/b/bar', "URL is left alone")
    t.equal(transaction.statusCode, 200, "status code is OK")
    t.equal(transaction.verb, 'GET', "HTTP method is GET")
    t.ok(transaction.trace, "transaction has trace")

    var web = transaction.trace.root.children[0]
    t.ok(web, "trace has web segment")
    t.equal(web.name, transaction.name, "segment name and transaction name match")
    t.equal(
      web.partialName, 'Expressjs/GET//a/:param1/b/:param2',
      'should have partial name for apdex'
    )
    t.equal(web.parameters.param1, 'foo', 'should have param1')
    t.equal(web.parameters.param2, 'bar', 'should have param2')
  })

  server.listen(8089, function() {
    var url = 'http://localhost:8089/a/foo/b/bar'
    request.get(url, {json : true}, function(error, res, body) {
      t.error(error, 'should not have errored')
      t.equal(res.statusCode, 200, 'should have ok status')
      t.deepEqual(body, {status : 'ok'}, 'should have expected response')
    })
  })
})
