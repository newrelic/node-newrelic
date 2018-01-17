'use strict'

var test    = require('tap').test
var request = require('request').defaults({json: true})
var helper  = require('../../lib/agent_helper')


test("Restify capture params introspection", function(t) {
  t.plan(4)

  t.test('simple case with no params', function(t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
    var server = require('restify').createServer()
    var port = null


    agent.config.attributes.enabled = true

    t.tearDown(function() {
      server.close()
      helper.unloadAgent(agent)
    })

    agent.on('transactionFinished', function(transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      var attributes = transaction.trace.attributes.get('transaction_tracer')
      if (attributes.httpResponseMessage) {
        t.deepEqual(attributes, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:" + port,
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          'request.uri' : "/test"
        }, 'parameters should only have request/response params')
      } else {
        t.deepEqual(attributes, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:" + port,
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          'request.uri' : "/test"
        }, 'parameters should only have request/response params')
      }
    })

    server.get('/test', function(req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(0, function() {
      port = server.address().port
      request.get('http://localhost:' + port + '/test', function(error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })

  t.test('case with route params', function(t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
    var server = require('restify').createServer()
    var port = null


    agent.config.attributes.enabled = true

    t.tearDown(function() {
      server.close()
      helper.unloadAgent(agent)
    })

    agent.on('transactionFinished', function(transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      var attributes = transaction.trace.attributes.get('transaction_tracer')
      if (attributes.httpResponseMessage) {
        t.deepEqual(attributes, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:" + port,
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "id" : "1337",
          'request.uri' : "/test/1337"
        }, 'parameters should have id')
      } else {
        t.deepEqual(attributes, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:" + port,
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "id" : "1337",
          'request.uri' : "/test/1337"
        }, 'parameters should have id')
      }
    })

    server.get('/test/:id', function(req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(0, function() {
      port = server.address().port
      request.get('http://localhost:' + port + '/test/1337', function(error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })

  t.test('case with query params', function(t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
    var server = require('restify').createServer()
    var port = null


    agent.config.attributes.enabled = true

    t.tearDown(function() {
      server.close()
      helper.unloadAgent(agent)
    })

    agent.on('transactionFinished', function(transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      var attributes = transaction.trace.attributes.get('transaction_tracer')
      if (attributes.httpResponseMessage) {
        t.deepEqual(attributes, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:" + port,
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "name" : "restify",
          'request.uri' : "/test"
        }, 'parameters should have name')
      } else {
        t.deepEqual(attributes, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:" + port,
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "name" : "restify",
          'request.uri' : "/test"
        }, 'parameters should have name')
      }
    })

    server.get('/test', function(req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(0, function() {
      port = server.address().port
      var url = 'http://localhost:' + port + '/test?name=restify'
      request.get(url, function(error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })

  t.test('case with both route and query params', function(t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
    var server = require('restify').createServer()
    var port = null


    agent.config.attributes.enabled = true

    t.tearDown(function() {
      server.close()
      helper.unloadAgent(agent)
    })

    agent.on('transactionFinished', function(transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      var attributes = transaction.trace.attributes.get('transaction_tracer')
      if (attributes.httpResponseMessage) {
        t.deepEqual(attributes, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:" + port,
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "id" : "1337",
          "name" : "restify",
          'request.uri' : "/test/1337"
        }, 'parameters should have id and name')
      } else {
        t.deepEqual(attributes, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:" + port,
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "id" : "1337",
          "name" : "restify",
          'request.uri' : "/test/1337"
        }, 'parameters should have id and name')
      }
    })

    server.get('/test/:id', function(req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(0, function() {
      port = server.address().port
      var url = 'http://localhost:' + port + '/test/1337?name=restify'
      request.get(url, function(error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })
})
