/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const utils = require('./hapi-utils')
const Boom = require('@hapi/boom')

tap.test('Hapi router introspection', function (t) {
  t.autoend()

  let agent = null
  let server = null
  let port = null

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })

    server = utils.getServer()
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    return server.stop()
  })

  t.test('using route handler - simple case', function (t) {
    agent.on('transactionFinished', verifier(t))

    server.route({
      method: 'GET',
      path: '/test/{id}',
      handler: function () {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function () {
      port = server.info.port
      const uri = 'http://localhost:' + port + '/test/31337'

      helper.makeGetRequest(uri, function (_error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('using route handler under config object', function (t) {
    agent.on('transactionFinished', verifier(t))

    const hello = {
      handler: function () {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    }

    server.route({
      method: 'GET',
      path: '/test/{id}',
      config: hello
    })

    server.start().then(function () {
      port = server.info.port
      const uri = 'http://localhost:' + port + '/test/31337'
      helper.makeGetRequest(uri, function (_error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('using route handler outside of config object', function (t) {
    agent.on('transactionFinished', verifier(t))

    server.route({
      method: 'GET',
      path: '/test/{id}',
      config: {},
      handler: function () {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function () {
      port = server.info.port
      const uri = 'http://localhost:' + port + '/test/31337'
      helper.makeGetRequest(uri, function (_error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('using `pre` config option', function (t) {
    agent.on('transactionFinished', verifier(t))

    const route = {
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
                t.ok(agent.getTransaction(), 'transaction available in nested `pre` function')
                return 'ok'
              }
            },
            {
              assign: 'pre3',
              method: function nested2() {
                t.ok(agent.getTransaction(), 'transaction available in 2nd nested `pre` function')
                return 'ok'
              }
            }
          ]
        ],
        handler: function (req) {
          t.ok(agent.getTransaction(), 'transaction is available in final handler')
          return { status: req.pre.pre3 }
        }
      }
    }
    server.route(route)

    server.start().then(function () {
      port = server.info.port
      const uri = 'http://localhost:' + port + '/test/31337'
      helper.makeGetRequest(uri, function (_error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('using custom handler type', function (t) {
    agent.on('transactionFinished', verifier(t))

    server.decorate('handler', 'hello', function () {
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

    server.start().then(function () {
      port = server.info.port
      const uri = 'http://localhost:' + port + '/test/31337'
      helper.makeGetRequest(uri, function (_error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  /*
   * This test covers the use case of placing defaults on the handler
   * function.
   * for example: https://github.com/hapijs/h2o2/blob/v6.0.1/lib/index.js#L189-L198
   */
  t.test('using custom handler defaults', function (t) {
    agent.on('transactionFinished', verifier(t, 'POST'))

    function handler(route) {
      t.equal(route.settings.payload.parse, false, 'should set the payload parse setting')
      t.equal(route.settings.payload.output, 'stream', 'should set the payload output setting')

      return function customHandler() {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
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

    server.start().then(function () {
      port = server.info.port
      const uri = 'http://localhost:' + port + '/test/31337'
      helper.makeRequest(uri, { method: 'POST' }, function (_error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })

  t.test('404 transaction is named correctly', function (t) {
    agent.on('transactionFinished', function (tx) {
      const [segment] = tx.trace.getChildren(tx.trace.root.id)
      t.equal(
        segment.name,
        'WebTransaction/Nodejs/GET/(not found)',
        '404 segment has standardized name'
      )
    })

    server.start().then(function () {
      port = server.info.port
      const uri = 'http://localhost:' + port + '/test'
      helper.makeGetRequest(uri, function (_error, res, body) {
        t.equal(res.statusCode, 404, 'nonexistent route was not found')
        t.same(
          body,
          { statusCode: 404, error: 'Not Found', message: 'Not Found' },
          'got expected response'
        )
        t.end()
      })
    })
  })

  t.test('using shared `pre` config option', function (t) {
    agent.on('transactionFinished', (transaction) => {
      t.equal(
        transaction.name,
        'WebTransaction/Hapi/GET//first/{firstId}/second/{secondId}/data',
        'transaction is named correctly'
      )
    })

    // Middlewares if shared across routes causing
    // issues with the new relic transactions
    const assignStuff = {
      method: async ({ params: { firstId, secondId } }) => {
        let stuff = null
        if (firstId && secondId) {
          stuff = await Promise.resolve({ id: 123 })
        }
        return stuff || Boom.notFound()
      },
      assign: 'stuff'
    }

    const assignMoreStuff = {
      method: async () => {
        return { test: 123 }
      },
      assign: 'stuff'
    }

    server.route([
      {
        method: 'GET',
        path: '/first/{firstId}/second/{secondId}/data', // I'm calling this URL
        config: {
          auth: false,
          pre: [assignStuff, assignMoreStuff],
          handler: async () => {
            return { success: 'TRUE' }
          }
        }
      },
      {
        method: 'POST',
        path: '/first/{firstId}/second/{secondId}/data', // This one should not be added as well
        config: {
          auth: false,
          pre: [assignStuff],
          handler: async () => ({ success: 'TRUE' })
        }
      },
      {
        method: 'GET',
        path: '/first/{firstId}/second/{secondId}/should-not-be-added',
        config: {
          auth: false,
          pre: [assignStuff],
          handler: async () => ({ success: 'TRUE' })
        }
      },
      {
        method: 'GET',
        path: '/first/{firstId}/second/{secondId}/should-not-be-added2',
        config: {
          auth: false,
          pre: [assignStuff],
          handler: async () => ({ success: 'TRUE' })
        }
      },
      {
        method: 'GET',
        path: '/first/{firstId}/second/{secondId}/should-not-be-added3',
        config: {
          auth: false,
          pre: [assignStuff, assignMoreStuff],
          handler: async () => ({ success: 'TRUE' })
        }
      }
    ])

    server.start().then(function () {
      port = server.info.port
      const uri = 'http://localhost:' + port + '/first/123/second/456/data'
      helper.makeGetRequest(uri, function (_error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { success: 'TRUE' }, 'got expected response')
        t.end()
      })
    })
  })
})

function verifier(t, verb) {
  verb = verb || 'GET'
  return function (transaction) {
    t.equal(
      transaction.name,
      'WebTransaction/Hapi/' + verb + '//test/{id}',
      'transaction has expected name'
    )

    t.equal(transaction.url, '/test/31337', 'URL is left alone')
    t.equal(transaction.statusCode, 200, 'status code is OK')
    t.equal(transaction.verb, verb, 'HTTP method is ' + verb)
    t.ok(transaction.trace, 'transaction has trace')

    const [web] = transaction.trace.getChildren(transaction.trace.root.id)
    t.ok(web, 'trace has web segment')
    t.equal(web.name, transaction.name, 'segment name and transaction name match')

    t.equal(web.partialName, 'Hapi/' + verb + '//test/{id}', 'should have partial name for apdex')

    t.equal(
      web.getAttributes()['request.parameters.route.id'],
      '31337',
      'namer gets attributes out of route'
    )
  }
}
