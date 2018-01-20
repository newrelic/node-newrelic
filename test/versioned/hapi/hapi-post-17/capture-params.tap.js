'use strict'

var tap = require('tap')
var request = require('request')
var helper = require('../../../lib/agent_helper')
var utils = require('./hapi-17-utils')

tap.test('Hapi capture params support', function(t) {
  t.autoend()

  var agent = null
  var server = null
  var port = null

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent({send_request_uri_attribute: true})
    server = utils.getServer()

    // disabled by default
    agent.config.capture_params = true
    done()
  })

  t.afterEach(function() {
    helper.unloadAgent(agent)
    return server.stop()
  })

  t.test('simple case with no params', function(t) {
    agent.on('transactionFinished', function(transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {
        'request.headers.accept': 'application/json',
        'request.headers.host': 'localhost:' + port,
        'request.method': 'GET',
        'response.headers.contentLength': 15,
        'response.headers.contentType': 'application/json; charset=utf-8',
        'response.status': 200,
        'httpResponseCode': '200',
        'httpResponseMessage': 'OK',
        'request_uri': '/test/'
      }, 'parameters should only have request/response params')
    })

    server.route({
      method: 'GET',
      path: '/test/',
      handler: function() {
        t.ok(agent.getTransaction(), 'transaction is available inside route handler')
        return { status: 'ok' }
      }
    })

    server.start().then(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test/',
        json: true
      }
      request.get(params, function(error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('case with route params', function(t) {
    agent.on('transactionFinished', function(transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {
        'request.headers.accept': 'application/json',
        'request.headers.host': 'localhost:' + port,
        'request.method': 'GET',
        'response.headers.contentLength': 15,
        'response.headers.contentType': 'application/json; charset=utf-8',
        'response.status': '200',
        'httpResponseCode': '200',
        'httpResponseMessage': 'OK',
        'id': '1337',
        'request_uri': '/test/1337/'
      }, 'parameters should have id')
    })

    server.route({
      method: 'GET',
      path: '/test/{id}/',
      handler: function() {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test/1337/',
        json: true
      }
      request.get(params, function(error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('case with query params', function(t) {
    agent.on('transactionFinished', function(transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {
        'request.headers.accept': 'application/json',
        'request.headers.host': 'localhost:' + port,
        'request.method': 'GET',
        'response.status': '200',
        'response.headers.contentLength': 15,
        'response.headers.contentType': 'application/json; charset=utf-8',
        'httpResponseCode': '200',
        'httpResponseMessage': 'OK',
        'name': 'hapi',
        'request_uri': '/test/'
      }, 'parameters should have name')
    })

    server.route({
      method: 'GET',
      path: '/test/',
      handler: function() {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test/?name=hapi',
        json: true
      }
      request.get(params, function(error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('case with both route and query params', function(t) {
    agent.on('transactionFinished', function(tx) {
      t.ok(tx.trace, 'transaction has a trace.')
      t.deepEqual(tx.trace.parameters, {
        'request.headers.accept': 'application/json',
        'request.headers.host': 'localhost:' + port,
        'request.method': 'GET',
        'request_uri': '/test/1337/',
        'name': 'hapi',
        'httpResponseCode': '200',
        'response.status': '200',
        'httpResponseMessage': 'OK',
        'response.headers.contentLength': 15,
        'response.headers.contentType': 'application/json; charset=utf-8',
        'id': '1337'
      }, 'parameters should have name and id')
    })

    server.route({
      method: 'GET',
      path: '/test/{id}/',
      handler: function() {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test/1337/?name=hapi',
        json: true
      }
      request.get(params, function(error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })
})
