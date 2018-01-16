'use strict'

var tap = require('tap')
var request = require('request')
var helper = require('../../../lib/agent_helper')
var HTTP_ATTS = require('../../../lib/fixtures').httpAttributes

module.exports = runTests

function runTests(createServer) {
  tap.test("Hapi capture params support", function(t) {
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
        HTTP_ATTS.forEach(function(key) {
          t.ok(attributes[key], 'Trace contains expected HTTP attribute: ' + key)
        })
      })

      server.route({
        method: 'GET',
        path: '/test/',
        handler: function(request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status: 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/')
      })
    })

    t.test("case with route params", function(t) {
      agent.on('transactionFinished', function(transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        var attributes = transaction.trace.attributes.get('transaction_tracer')
        t.equal(attributes.id, '1337', 'Trace attributes include `id` route param')
      })

      server.route({
        method: 'GET',
        path: '/test/{id}/',
        handler: function(request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status: 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/1337/')
      })
    })

    t.test("case with query params", function(t) {
      agent.on('transactionFinished', function(transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        var attributes = transaction.trace.attributes.get('transaction_tracer')
        t.equal(attributes.name, 'hapi', 'Trace attributes include `name` query param')
      })

      server.route({
        method: 'GET',
        path: '/test/',
        handler: function(request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status: 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/?name=hapi')
      })
    })

    t.test("case with both route and query params", function(t) {
      agent.on('transactionFinished', function(transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        var attributes = transaction.trace.attributes.get('transaction_tracer')
        t.equal(attributes.id, '1337', 'Trace attributes include `id` route param')
        t.equal(attributes.name, 'hapi', 'Trace attributes include `name` query param')
      })

      server.route({
        method: 'GET',
        path: '/test/{id}/',
        handler: function(request, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status: 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/1337/?name=hapi')
      })
    })
  })
}

function makeRequest(t, uri) {
  var params = {
    uri: uri,
    json: true
  }
  request.get(params, function(err, res, body) {
    t.equal(res.statusCode, 200, "nothing exploded")
    t.deepEqual(body, {status: 'ok'}, "got expected response")
    t.end()
  })
}
