'use strict'

// hapi depends on node 0.10.x
var semver = require('semver')
if (semver.satisfies(process.version, '<0.10')) {
  console.log('TAP version 13\n# disabled because of incompatibility')
  console.log('ok 1 nothing to do\n\n1..1\n\n# ok')
  process.exit(0)
}

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper.js'))



test("Hapi vhost support", function (t) {
  t.plan(1)

  t.test("should not explode when using vhosts", function (t) {
    var agent  = helper.instrumentMockedAgent()
      , hapi   = require('hapi')
      , server = hapi.createServer('localhost', 8089)


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
      method: 'GET',
      path: '/test/',
      vhost: 'localhost',
      handler: function (request, reply) {
        t.ok(agent.getTransaction(), "transaction is available")

        reply({status : 'ok'})
      }
    })

    server.route({
      method: 'GET',
      path: '/test/2',
      vhost: 'localhost',
      handler: function (request, reply) {
        t.ok(agent.getTransaction(), "transaction is available")

        reply({status : 'ok'})
      }
    })

    server.start(function () {
      request.get('http://localhost:8089/test/2',
                  {json : true},
                  function (error, res, body) {

        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected response")
      })
    })
  })
})
