'use strict'

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require('../../lib/agent_helper.js')


test("Express 3 router introspection", function (t) {
  t.plan(12)

  var agent   = helper.instrumentMockedAgent()
    , express = require('express')
    , app     = express()
    , server  = require('http').createServer(app)


  this.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
    server.close(function cb_close() {})
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

test('Express 3 router middleware does not affect naming', function testMiddleware(t) {
  t.plan(12)

  var agent = helper.instrumentMockedAgent()
  var express = require('express')
  var app = express()
  var server = require('http').createServer(app)

  this.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
    server.close(function cb_close() {})
  })

  // need to capture parameters
  agent.config.capture_params = true

  agent.on('transactionFinished', function onFinished(transaction) {
    t.equal(
      transaction.name,
      'WebTransaction/Expressjs/GET//test/:id',
      'transaction has expected name'
    )
    t.equal(transaction.url, '/test/31337', 'URL is left alone')
    t.equal(transaction.statusCode, 200, 'status code is OK')
    t.equal(transaction.verb, 'GET', 'HTTP method is GET')
    t.ok(transaction.trace, 'transaction has trace')

    var web = transaction.trace.root.children[0]
    t.ok(web, 'trace has web segment')
    t.equal(web.name, transaction.name, 'segment name and transaction name match')
    t.equal(web.partialName, 'Expressjs/GET//test/:id',
            'should have partial name for apdex')
    t.equal(web.parameters.id, '31337', 'namer gets parameters out of route')
  })

  app.use(function middleware(req, res, next) {
    next()
  })

  app.get('/*', function globalishMiddleware(req, res, next) {
    next()
  })

  app.get('/test/:id', function routeSpecificMiddleware(req, res, next) {
    setTimeout(next, 0)
  })

  app.get('/test/:id', function handler(req, res) {
    t.ok(agent.getTransaction(), "transaction is available")

    res.send({status: 'ok'})
    res.end()
  })

  server.listen(8089, function listening() {
    request.get('http://localhost:8089/test/31337', {json: true}, gotResonse)

    function gotResonse(error, res, body) {
      t.equal(res.statusCode, 200, 'nothing exploded')
      t.deepEqual(body, {status: 'ok'}, 'got expected response')
    }
  })
})
