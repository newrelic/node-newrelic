'use strict'

var tap = require('tap')
var request = require('request')
var helper = require('../../lib/agent_helper')
var utils = require('./hapi-utils')

tap.test('Hapi vhost support', function(t) {
  t.plan(1)

  var port = null

  t.test('should not explode when using vhosts', function(t) {
    var agent = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
    var server = utils.getServer()

    // disabled by default
    agent.config.capture_params = true

    t.tearDown(function() {
      server.stop(function() {
        helper.unloadAgent(agent)
      })
    })

    agent.on('transactionFinished', function(tx) {
      t.ok(tx.trace, 'transaction has a trace.')
      if (tx.trace.parameters.httpResponseMessage) {
        t.ok(tx.trace.parameters.httpResponseMessage, 'OK')
        delete tx.trace.parameters.httpResponseMessage
      }
      t.deepEqual(tx.trace.parameters, {
        'request.headers.accept': 'application/json',
        'request.headers.host': 'localhost:' + port,
        'request.method': 'GET',
        'response.status': '200',
        'response.headers.contentLength': 15,
        'response.headers.contentType': 'application/json; charset=utf-8',
        'httpResponseCode': '200',
        'request_uri': '/test/2'
      }, 'parameters should only have request/response params')
    })

    server.route({
      method: 'GET',
      path: '/test/',
      vhost: 'localhost',
      handler: function(request, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
        reply({status: 'ok'})
      }
    })

    server.route({
      method: 'GET',
      path: '/test/2',
      vhost: 'localhost',
      handler: function(request, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
        reply({status: 'ok'})
      }
    })

    server.start(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test/2',
        json: true
      }
      request.get(params, function(error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, {status: 'ok'}, 'got expected response')
        t.end()
      })
    })
  })
})
