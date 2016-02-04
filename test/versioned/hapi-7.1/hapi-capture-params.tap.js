'use strict'

// hapi depends on node 0.10.x
var semver = require('semver')
if (semver.satisfies(process.version, '<0.10')) {
  console.log('TAP version 13\n# disabled because of incompatibility')
  console.log('ok 1 nothing to do\n\n1..1\n\n# ok')
  process.exit(0)
}

var path    = require('path')
var test    = require('tap').test
var request = require('request')
var helper  = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper.js'))



test("Hapi capture params support", function (t) {
  t.plan(4)

  t.test("simple case with no params", function (t) {
    var agent  = helper.instrumentMockedAgent()
    var hapi   = require('hapi')
    var server = hapi.createServer('localhost', 8089)


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
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
        }, 'parameters should only have request/response params')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
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
    var agent  = helper.instrumentMockedAgent()
    var hapi   = require('hapi')
    var server = hapi.createServer('localhost', 8089)


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
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "id" : "1337"
        }, 'parameters should have id')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "id" : "1337"
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
    var agent  = helper.instrumentMockedAgent()
    var hapi   = require('hapi')
    var server = hapi.createServer('localhost', 8089)


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
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "name" : "hapi"
        }, 'parameters should have name')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "name" : "hapi"
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
    var agent  = helper.instrumentMockedAgent()
    var hapi   = require('hapi')
    var server = hapi.createServer('localhost', 8089)


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
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "id" : "1337",
          "name" : "hapi"
        }, 'parameters should have name and id')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.accept" : "application/json",
          "request.headers.host" : "localhost:8089",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "id" : "1337",
          "name" : "hapi"
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
