'use strict'

var tap = require('tap')
var request = require('request')
var helper = require('../../../lib/agent_helper')
var utils = require('./hapi-utils')

tap.test('Hapi router introspection', function(t) {
  t.plan(3)

  var agent = null
  var server = null
  var port = null

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })

    server = utils.getServer()

    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    server.stop(done)
  })

  t.test('simple case using server.route', function(t) {
    agent.on('transactionFinished', utils.verifier(t))

    var route = {
      method: 'GET',
      path: '/test/{id}',
      handler: function(req, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
        reply({status: 'ok'})
      }
    }
    server.route(route)

    server.start(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test/31337',
        json: true
      }
      request.get(params, function(error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, {status: 'ok'}, 'got expected response')
        t.end()
      })
    })
  })

  t.test('less simple case (server.addRoute & route.config.handler)', function(t) {
    agent.on('transactionFinished', utils.verifier(t))

    var hello = {
      handler: function(req, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
        reply({status: 'ok'})
      }
    }

    var route = {
      method: 'GET',
      path: '/test/{id}',
      config: hello
    }
    server.route(route)

    server.start(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test/31337',
        json: true
      }
      request.get(params, function(error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, {status: 'ok'}, 'got expected response')
        t.end()
      })
    })
  })

  t.test('404 transaction is named correctly', function(t) {
    agent.on('transactionFinished', function(tx) {
      t.equal(
        tx.trace.root.children[0].name,
        'WebTransaction/Nodejs/GET/(not found)',
        '404 segment has standardized name'
      )
    })

    server.start(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test',
        json: true
      }
      request.get(params, function(error, res, body) {
        t.equal(res.statusCode, 404, 'nonexistent route was not found')
        t.deepEqual(body, {statusCode: 404, error: 'Not Found'}, 'got expected response')
        t.end()
      })
    })
  })
})
