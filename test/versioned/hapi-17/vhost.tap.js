'use strict'

var tap = require('tap')
var request = require('request')
var helper = require('../../lib/agent_helper')
var utils = require('../hapi/hapi-utils')

tap.test('Hapi vhost support', function(t) {
  t.autoend()

  t.test('should not explode when using vhosts', function(t) {
    var agent = helper.instrumentMockedAgent({ send_request_uri_attribute: true })
    var server = utils.getServer()
    var port

    t.tearDown(function() {
      return server.stop()
    })

    // disabled by default
    agent.config.capture_params = true

    agent.on('transactionFinished', function(transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {
        'request.headers.accept': 'application/json',
        'request.headers.host': 'localhost:' + port,
        'request.method': 'GET',
        'response.status': 200,
        'response.headers.contentLength': 15,
        'response.headers.contentType': 'application/json; charset=utf-8',
        'httpResponseCode': '200',
        'httpResponseMessage': 'OK',
        'id': '1337',
        'name': 'hapi',
        'request_uri': '/test/1337/2'
      }, 'parameters should have name and id')

      helper.unloadAgent(agent)
    })

    server.route({
      method: 'GET',
      path: '/test/{id}/',
      vhost: 'localhost',
      handler: function() {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status : 'ok' }
      }
    })

    server.route({
      method: 'GET',
      path: '/test/{id}/2',
      vhost: 'localhost',
      handler: function() {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test/1337/2?name=hapi',
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
