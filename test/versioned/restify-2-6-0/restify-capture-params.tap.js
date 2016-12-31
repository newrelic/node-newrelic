'use strict'

var path    = require('path')
var test    = require('tap').test
var request = require('request')
var helper  = require('../../lib/agent_helper.js')
var semver = require('semver')


test(
  "Restify capture params introspection",
  {skip: function () {return semver.satisfies(process.version, '>=7.0.0')}},
  function (t) {
  t.plan(4)

  t.test('simple case with no params', function (t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
    var server = require('restify').createServer()


    agent.config.capture_params = true

    t.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      if (transaction.trace.parameters.httpResponseMessage) {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "request_uri" : "/test"
        }, 'parameters should only have request/response params')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "request_uri" : "/test"
        }, 'parameters should only have request/response params')
      }
    })

    server.get('/test', function (req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(8089, function () {
      request.get('http://localhost:8089/test',
                  {json : true},
                  function (error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })

  t.test('case with route params', function (t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
    var server = require('restify').createServer()


    agent.config.capture_params = true

    t.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      if (transaction.trace.parameters.httpResponseMessage) {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "id" : "1337",
          "request_uri" : "/test/1337"
        }, 'parameters should have id')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "id" : "1337",
          "request_uri" : "/test/1337"
        }, 'parameters should have id')
      }
    })

    server.get('/test/:id', function (req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(8089, function () {
      request.get('http://localhost:8089/test/1337',
                  {json : true},
                  function (error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })

  t.test('case with query params', function (t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
    var server = require('restify').createServer()


    agent.config.capture_params = true

    t.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      if (transaction.trace.parameters.httpResponseMessage) {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "name" : "restify",
          "request_uri" : "/test"
        }, 'parameters should have name')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "name" : "restify",
          "request_uri" : "/test"
        }, 'parameters should have name')
      }
    })

    server.get('/test', function (req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(8089, function () {
      request.get('http://localhost:8089/test?name=restify',
                  {json : true},
                  function (error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })

  t.test('case with both route and query params', function (t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
    var server = require('restify').createServer()


    agent.config.capture_params = true

    t.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      if (transaction.trace.parameters.httpResponseMessage) {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "id" : "1337",
          "name" : "restify",
          "request_uri" : "/test/1337"
        }, 'parameters should have id and name')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "15",
          "response.headers.contentType" : "application/json",
          "id" : "1337",
          "name" : "restify",
          "request_uri" : "/test/1337"
        }, 'parameters should have id and name')
      }
    })

    server.get('/test/:id', function (req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(8089, function () {
      request.get('http://localhost:8089/test/1337?name=restify',
                  {json : true},
                  function (error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })

})
