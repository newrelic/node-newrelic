'use strict'

// hapi 1.20.0 depends on node 0.10.x
if (process.version.split('.')[1] < 10) {
  console.log('TAP version 13\n# disabled because of incompatibility')
  console.log('ok 1 nothing to do\n\n1..1\n\n# ok')
  process.exit(0)
}

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require('../../lib/agent_helper.js')


function verifier(t, finished) {
  return function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Hapi/GET//test/{id}',
            "transaction has expected name")
    t.equal(transaction.url, '/test/31337', "URL is left alone")
    t.equal(transaction.statusCode, 200, "status code is OK")
    t.equal(transaction.verb, 'GET', "HTTP method is GET")
    t.ok(transaction.trace, "transaction has trace")

    var web = transaction.trace.root.children[0]
    t.ok(web, "trace has web segment")
    t.equal(web.name, transaction.name, "segment name and transaction name match")
    t.equal(web.partialName, 'Hapi/GET//test/{id}',
            "should have partial name for apdex")
    t.equal(web.parameters.id, '31337', "namer gets parameters out of route")

    finished()
  }
}

test("Hapi router introspection", function (t) {
  t.plan(2)

  t.test("simple case using server.route", function (t) {
    var agent  = helper.instrumentMockedAgent()
      , hapi   = require('hapi')
      , server = hapi.createServer('localhost', 8089)


    // disabled by default
    agent.config.capture_params = true

    agent.on('transactionFinished', verifier(t, function () {
      helper.unloadAgent(agent)
      server.stop(function () {
        t.end()
      })
    }))

    var route = {
      method : 'GET',
      path   : '/test/{id}',
      handler : function (request, reply) {
        t.ok(agent.getTransaction(), "transaction is available")

        reply({status : 'ok'})
      }
    }
    server.route(route)

    server.start(function () {
      request.get('http://localhost:8089/test/31337',
                  {json : true},
                  function (error, res, body) {

        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected response")
      })
    })
  })

  t.test("less simple case (server.addRoute & route.config.handler)", function (t) {
    var agent  = helper.instrumentMockedAgent()
      , hapi   = require('hapi')
      , server = hapi.createServer('localhost', 8089)


    agent.config.capture_params = true

    agent.on('transactionFinished', verifier(t, function () {
      helper.unloadAgent(agent)
      server.stop(function () {
        t.end()
      })
    }))

    var hello = {
      handler : function (request, reply) {
        t.ok(agent.getTransaction(), "transaction is available")

        reply({status : 'ok'})
      }
    }

    var route = {
      method : 'GET',
      path   : '/test/{id}',
      config : hello
    }
    server.route(route)

    server.start(function () {
      request.get('http://localhost:8089/test/31337',
                  {json : true},
                  function (error, res, body) {

        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected response")
      })
    })
  })
})
