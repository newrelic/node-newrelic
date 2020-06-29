/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var tap = require('tap')
var request = require('request')
var helper = require('../../../lib/agent_helper')
var utils = require('./hapi-17-utils')

tap.test('Hapi router introspection', function(t) {
  t.autoend()

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

  t.afterEach(function() {
    helper.unloadAgent(agent)
    return server.stop()
  })

  t.test('using route handler - simple case', function(t) {
    agent.on('transactionFinished', verifier(t))

    server.route({
      method: 'GET',
      path: '/test/{id}',
      handler: function() {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function() {
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

  t.test('using route handler under config object', function(t) {
    agent.on('transactionFinished', verifier(t))

    var hello = {
      handler: function() {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    }

    server.route({
      method: 'GET',
      path: '/test/{id}',
      config: hello
    })

    server.start().then(function() {
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

  t.test('using route handler outside of config object', function(t) {
    agent.on('transactionFinished', verifier(t))

    server.route({
      method: 'GET',
      path: '/test/{id}',
      config: {},
      handler: function() {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function() {
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

  t.test('using `pre` config option', function(t) {
    agent.on('transactionFinished', verifier(t))

    var route = {
      method: 'GET',
      path: '/test/{id}',
      options: {
        pre: [
          function plain() {
            t.ok(agent.getTransaction(), 'transaction available in plain `pre` function')
            return 'ok'
          },
          [
            {
              method: function nested() {
                t.ok(
                  agent.getTransaction(),
                  'transaction available in nested `pre` function'
                )
                return 'ok'
              }
            },
            {
              assign: 'pre3',
              method: function nested2() {
                t.ok(
                  agent.getTransaction(),
                  'transaction available in 2nd nested `pre` function'
                )
                return 'ok'
              }
            }
          ]
        ],
        handler: function(req) {
          t.ok(agent.getTransaction(), 'transaction is available in final handler')
          return {status: req.pre.pre3}
        }
      }
    }
    server.route(route)

    server.start().then(function() {
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

  t.test('using custom handler type', function(t) {
    agent.on('transactionFinished', verifier(t))

    server.decorate('handler', 'hello', function() {
      return function customHandler() {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.route({
      method: 'GET',
      path: '/test/{id}',
      handler: {
        hello: {}
      }
    })

    server.start().then(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test/31337',
        json: true
      }
      request.get(params, function(error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, {status : 'ok'}, 'got expected response')
        t.end()
      })
    })
  })

  /*
   * This test covers the use case of placing defaults on the handler
   * function.
   * for example: https://github.com/hapijs/h2o2/blob/v6.0.1/lib/index.js#L189-L198
   */
  t.test('using custom handler defaults', function(t) {
    agent.on('transactionFinished', verifier(t, 'POST'))

    function handler(route) {
      t.equal(route.settings.payload.parse, false, 'should set the payload parse setting')
      t.equal(
        route.settings.payload.output,
        'stream',
        'should set the payload output setting'
      )

      return function customHandler() {
        t.ok(agent.getTransaction(), 'transaction is available')
        return {status: 'ok'}
      }
    }

    handler.defaults = {
      payload: {
        output: 'stream',
        parse: false
      }
    }

    server.decorate('handler', 'hello', handler)

    server.route({
      method: 'POST',
      path: '/test/{id}',
      handler: {
        hello: {}
      }
    })

    server.start().then(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test/31337',
        json: true
      }
      request.post(params, function(error, res, body) {
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

    server.start().then(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test',
        json: true
      }
      request.get(params, function(error, res, body) {
        t.equal(res.statusCode, 404, 'nonexistent route was not found')
        t.deepEqual(
          body,
          {statusCode: 404, error: 'Not Found', message: 'Not Found'},
          'got expected response'
        )
        t.end()
      })
    })
  })
})

function verifier(t, verb) {
  verb = verb || 'GET'
  return function(transaction) {
    t.equal(
      transaction.name,
      'WebTransaction/Hapi/' + verb + '//test/{id}',
      'transaction has expected name'
    )

    t.equal(transaction.url, '/test/31337', 'URL is left alone')
    t.equal(transaction.statusCode, 200, 'status code is OK')
    t.equal(transaction.verb, verb, 'HTTP method is ' + verb)
    t.ok(transaction.trace, 'transaction has trace')

    var web = transaction.trace.root.children[0]
    t.ok(web, 'trace has web segment')
    t.equal(web.name, transaction.name, 'segment name and transaction name match')

    t.equal(
      web.partialName,
      'Hapi/' + verb + '//test/{id}',
      'should have partial name for apdex'
    )

    t.equal(
      web.getAttributes()['request.parameters.id'], '31337',
      'namer gets attributes out of route'
    )
  }
}
