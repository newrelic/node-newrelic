'use strict'

var test    = require('tap').test
var request = require('request')
var helper  = require('../../../lib/agent_helper.js')

module.exports = runTests

function runTests(createServer) {
  test("Hapi capture params support", function(t) {
    t.autoend()

    var agent = null
    var server = null
    var port = null

    t.beforeEach(function(done) {
      agent = helper.instrumentMockedAgent({send_request_uri_attribute: true})

      server = createServer()

      // disabled by default
      agent.config.attributes.enabled = true
      done()
    })

    t.afterEach(function(done) {
      helper.unloadAgent(agent)
      server.stop(done)
    })

    t.test("simple case with no params", function(t) {
      agent.on('transactionFinished', function(transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        var attributes = transaction.trace.attributes.get('transaction_tracer')
        if (attributes.httpResponseMessage) {
          t.deepEqual(attributes, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:" + port,
            "request.method" : "GET",
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "response.status" : '200',
            "httpResponseCode": "200",
            "httpResponseMessage": "OK",
            request_uri: "/test/"
          }, 'parameters should only have request/response params')
        } else {
          t.deepEqual(attributes, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:" + port,
            "request.method" : "GET",
            "response.status" : '200',
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            request_uri: "/test/"
          }, 'parameters should only have request/response params')
        }
      })

      server.route({
        method : 'GET',
        path   : '/test/',
        handler : function(request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status : 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port || 8089
        request.get('http://localhost:' + port + '/test/',
                    {json : true},
                    function(error, res, body) {

          t.equal(res.statusCode, 200, "nothing exploded")
          t.deepEqual(body, {status : 'ok'}, "got expected response")
          t.end()
        })
      })
    })

    t.test("case with route params", function(t) {
      agent.on('transactionFinished', function(transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        var attributes = transaction.trace.attributes.get('transaction_tracer')
        if (attributes.httpResponseMessage) {
          t.deepEqual(attributes, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:" + port,
            "request.method" : "GET",
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "response.status" : '200',
            "httpResponseCode": "200",
            "httpResponseMessage": "OK",
            "id" : "1337",
            request_uri: "/test/1337/"
          }, 'parameters should have id')
        } else {
          t.deepEqual(attributes, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:" + port,
            "request.method" : "GET",
            "response.status" : '200',
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            "id" : "1337",
            request_uri: "/test/1337/"
          }, 'parameters should have id')
        }
      })

      server.route({
        method : 'GET',
        path   : '/test/{id}/',
        handler : function(request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status : 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port || 8089
        request.get('http://localhost:' + port + '/test/1337/',
                    {json : true},
                    function(error, res, body) {

          t.equal(res.statusCode, 200, "nothing exploded")
          t.deepEqual(body, {status : 'ok'}, "got expected response")
          t.end()
        })
      })
    })

    t.test("case with query params", function(t) {
      agent.on('transactionFinished', function(transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        var attributes = transaction.trace.attributes.get('transaction_tracer')
        if (attributes.httpResponseMessage) {
          t.deepEqual(attributes, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:" + port,
            "request.method" : "GET",
            "response.status" : '200',
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            "httpResponseMessage": "OK",
            "name" : "hapi",
            request_uri: "/test/"
          }, 'parameters should have name')
        } else {
          t.deepEqual(attributes, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:" + port,
            "request.method" : "GET",
            "response.status" : '200',
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            "name" : "hapi",
            request_uri: "/test/"
          }, 'parameters should have name')
        }
      })

      server.route({
        method : 'GET',
        path   : '/test/',
        handler : function(request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status : 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port || 8089
        request.get('http://localhost:' + port + '/test/?name=hapi',
                    {json : true},
                    function(error, res, body) {

          t.equal(res.statusCode, 200, "nothing exploded")
          t.deepEqual(body, {status : 'ok'}, "got expected response")
          t.end()
        })
      })
    })

    t.test("case with both route and query params", function(t) {
      agent.on('transactionFinished', function(transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        var attributes = transaction.trace.attributes.get('transaction_tracer')
        if (attributes.httpResponseMessage) {
          t.deepEqual(attributes, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:" + port,
            "request.method" : "GET",
            "response.status" : '200',
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            "httpResponseMessage": "OK",
            "id" : "1337",
            "name" : "hapi",
            request_uri: "/test/1337/"
          }, 'parameters should have name and id')
        } else {
          t.deepEqual(attributes, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:" + port,
            "request.method" : "GET",
            "response.status" : '200',
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            "id" : "1337",
            "name" : "hapi",
            request_uri: "/test/1337/"
          }, 'parameters should have name and id')
        }
      })

      server.route({
        method : 'GET',
        path   : '/test/{id}/',
        handler : function(request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status : 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port || 8089
        request.get('http://localhost:' + port + '/test/1337/?name=hapi',
                    {json : true},
                    function(error, res, body) {

          t.equal(res.statusCode, 200, "nothing exploded")
          t.deepEqual(body, {status : 'ok'}, "got expected response")
          t.end()
        })
      })
    })
  })
}
