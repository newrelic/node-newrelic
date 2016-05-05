var path    = require('path')
var test    = require('tap').test
var request = require('request')
var helper  = require('../../../lib/agent_helper.js')
var instrument = require('../../../../lib/instrumentation/hapi.js')


module.exports = runTests

function runTests(hapi, createServer) {
  if (!createServer) {
    createServer = function createServer(host, port) {
      var server = new hapi.Server()
      server.connection({
        host: host,
        port: port
      })
      return server
    }
  }

  test("Hapi capture params support", function (t) {
    t.plan(4)

    t.test("simple case with no params", function (t) {
      var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
      instrument(agent, hapi)
      var server = createServer('localhost', 8089)

      // disabled by default
      agent.config.capture_params = true

      agent.on('transactionFinished', function (transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        if (transaction.trace.parameters.httpResponseMessage) {
          t.deepEqual(transaction.trace.parameters, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:8089",
            "request.method" : "GET",
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "response.status" : 200,
            "httpResponseCode": "200",
            "httpResponseMessage": "OK",
            "request_uri": "/test/"
          }, 'parameters should only have request/response params')
        } else {
          t.deepEqual(transaction.trace.parameters, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:8089",
            "request.method" : "GET",
            "response.status" : 200,
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            "request_uri": "/test/"
          }, 'parameters should only have request/response params')
        }

        helper.unloadAgent(agent)
        server.stop(function () {
          t.end()
        })
      })

      server.route({
        method : 'GET',
        path   : '/test/',
        handler : function (request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status : 'ok'})
        }
      })

      server.start(function () {
        request.get('http://localhost:8089/test/',
                    {json : true},
                    function (error, res, body) {

          t.equal(res.statusCode, 200, "nothing exploded")
          t.deepEqual(body, {status : 'ok'}, "got expected response")
        })
      })
    })

    t.test("case with route params", function (t) {
      var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })

      instrument(agent, hapi)
      var server = createServer('localhost', 8089)

      // disabled by default
      agent.config.capture_params = true

      agent.on('transactionFinished', function (transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        if (transaction.trace.parameters.httpResponseMessage) {
          t.deepEqual(transaction.trace.parameters, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:8089",
            "request.method" : "GET",
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "response.status" : 200,
            "httpResponseCode": "200",
            "httpResponseMessage": "OK",
            "id" : "1337",
            "request_uri": "/test/1337/"
          }, 'parameters should have id')
        } else {
          t.deepEqual(transaction.trace.parameters, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:8089",
            "request.method" : "GET",
            "response.status" : 200,
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            "id" : "1337",
            "request_uri": "/test/1337/"
          }, 'parameters should have id')
        }

        helper.unloadAgent(agent)
        server.stop(function () {
          t.end()
        })
      })

      server.route({
        method : 'GET',
        path   : '/test/{id}/',
        handler : function (request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status : 'ok'})
        }
      })

      server.start(function () {
        request.get('http://localhost:8089/test/1337/',
                    {json : true},
                    function (error, res, body) {

          t.equal(res.statusCode, 200, "nothing exploded")
          t.deepEqual(body, {status : 'ok'}, "got expected response")
        })
      })
    })

    t.test("case with query params", function (t) {
      var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
      instrument(agent, hapi)
      var server = createServer('localhost', 8089)

      // disabled by default
      agent.config.capture_params = true

      agent.on('transactionFinished', function (transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        if (transaction.trace.parameters.httpResponseMessage) {
          t.deepEqual(transaction.trace.parameters, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:8089",
            "request.method" : "GET",
            "response.status" : 200,
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            "httpResponseMessage": "OK",
            "name" : "hapi",
            "request_uri": "/test/"
          }, 'parameters should have name')
        } else {
          t.deepEqual(transaction.trace.parameters, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:8089",
            "request.method" : "GET",
            "response.status" : 200,
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            "name" : "hapi",
            "request_uri": "/test/"
          }, 'parameters should have name')
        }

        helper.unloadAgent(agent)
        server.stop(function () {
          t.end()
        })
      })

      server.route({
        method : 'GET',
        path   : '/test/',
        handler : function (request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status : 'ok'})
        }
      })

      server.start(function () {
        request.get('http://localhost:8089/test/?name=hapi',
                    {json : true},
                    function (error, res, body) {

          t.equal(res.statusCode, 200, "nothing exploded")
          t.deepEqual(body, {status : 'ok'}, "got expected response")
        })
      })
    })

   t.test("case with both route and query params", function (t) {
      var agent  = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
      instrument(agent, hapi)
      var server = createServer('localhost', 8089)

      // disabled by default
      agent.config.capture_params = true

      agent.on('transactionFinished', function (transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        if (transaction.trace.parameters.httpResponseMessage) {
          t.deepEqual(transaction.trace.parameters, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:8089",
            "request.method" : "GET",
            "response.status" : 200,
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            "httpResponseMessage": "OK",
            "id" : "1337",
            "name" : "hapi",
            "request_uri": "/test/1337/"
          }, 'parameters should have name and id')
        } else {
          t.deepEqual(transaction.trace.parameters, {
            "request.headers.accept" : "application/json",
            "request.headers.host" : "localhost:8089",
            "request.method" : "GET",
            "response.status" : 200,
            "response.headers.contentLength" : 15,
            "response.headers.contentType" : "application/json; charset=utf-8",
            "httpResponseCode": "200",
            "id" : "1337",
            "name" : "hapi",
            "request_uri": "/test/1337/"
          }, 'parameters should have name and id')
        }

        helper.unloadAgent(agent)
        server.stop(function () {
          t.end()
        })
      })

      server.route({
        method : 'GET',
        path   : '/test/{id}/',
        handler : function (request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status : 'ok'})
        }
      })

      server.start(function () {
        request.get('http://localhost:8089/test/1337/?name=hapi',
                    {json : true},
                    function (error, res, body) {

          t.equal(res.statusCode, 200, "nothing exploded")
          t.deepEqual(body, {status : 'ok'}, "got expected response")
        })
      })
    })
  })
}
