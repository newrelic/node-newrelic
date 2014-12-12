'use strict'

// hapi depends on node 0.10.x
if (process.version.split('.')[1] < 10) {
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
      , server = new hapi.Server()

    server.connection({
      port: 8089
    })


    // disabled by default
    agent.config.capture_params = true

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {id: 1337, name: 'hapi'}, 'parameters should have name and id')

      helper.unloadAgent(agent)
      server.stop(function () {
        t.end()
      })
    })

    server.route({
      method: 'GET',
      path: '/test/{id}/',
      vhost: 'localhost',
      handler: function (request, reply) {
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
