/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const Boom = require('@hapi/boom')

const helper = require('../../lib/agent_helper')
const utils = require('./hapi-utils')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    attributes: {
      enabled: true,
      include: ['request.parameters.*']
    }
  })

  ctx.nr.server = utils.getServer()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.stop()
})

function verifier(verb = 'GET') {
  return function (transaction) {
    assert.equal(
      transaction.name,
      'WebTransaction/Hapi/' + verb + '//test/{id}',
      'transaction has expected name'
    )

    assert.equal(transaction.url, '/test/31337', 'URL is left alone')
    assert.equal(transaction.statusCode, 200, 'status code is OK')
    assert.equal(transaction.verb, verb, 'HTTP method is ' + verb)
    assert.ok(transaction.trace, 'transaction has trace')

    const web = transaction.trace.root.children[0]
    assert.ok(web, 'trace has web segment')
    assert.equal(web.name, transaction.name, 'segment name and transaction name match')

    assert.equal(
      web.partialName,
      'Hapi/' + verb + '//test/{id}',
      'should have partial name for apdex'
    )

    assert.equal(
      web.getAttributes()['request.parameters.route.id'],
      '31337',
      'namer gets attributes out of route'
    )
  }
}

test('using route handler - simple case', (t, end) => {
  const { agent, server } = t.nr
  agent.on('transactionFinished', verifier())

  server.route({
    method: 'GET',
    path: '/test/{id}',
    handler: function () {
      assert.ok(agent.getTransaction(), 'transaction is available')
      return { status: 'ok' }
    }
  })

  server.start().then(function () {
    const port = server.info.port
    const uri = 'http://localhost:' + port + '/test/31337'

    helper.makeGetRequest(uri, {}, function (_error, res, body) {
      assert.equal(res.statusCode, 200, 'nothing exploded')
      assert.deepStrictEqual(body, { status: 'ok' }, 'got expected response')
      end()
    })
  })
})

test('using route handler under config object', (t, end) => {
  const { agent, server } = t.nr
  agent.on('transactionFinished', verifier())

  const hello = {
    handler: function () {
      assert.ok(agent.getTransaction(), 'transaction is available')
      return { status: 'ok' }
    }
  }

  server.route({
    method: 'GET',
    path: '/test/{id}',
    config: hello
  })

  server.start().then(function () {
    const port = server.info.port
    const uri = 'http://localhost:' + port + '/test/31337'
    helper.makeGetRequest(uri, {}, function (_error, res, body) {
      assert.equal(res.statusCode, 200, 'nothing exploded')
      assert.deepStrictEqual(body, { status: 'ok' }, 'got expected response')
      end()
    })
  })
})

test('using route handler outside of config object', (t, end) => {
  const { agent, server } = t.nr
  agent.on('transactionFinished', verifier())

  server.route({
    method: 'GET',
    path: '/test/{id}',
    config: {},
    handler: function () {
      assert.ok(agent.getTransaction(), 'transaction is available')
      return { status: 'ok' }
    }
  })

  server.start().then(function () {
    const port = server.info.port
    const uri = 'http://localhost:' + port + '/test/31337'
    helper.makeGetRequest(uri, {}, function (_error, res, body) {
      assert.equal(res.statusCode, 200, 'nothing exploded')
      assert.deepStrictEqual(body, { status: 'ok' }, 'got expected response')
      end()
    })
  })
})

test('using `pre` config option', (t, end) => {
  const { agent, server } = t.nr
  agent.on('transactionFinished', verifier())

  const route = {
    method: 'GET',
    path: '/test/{id}',
    options: {
      pre: [
        function plain() {
          assert.ok(agent.getTransaction(), 'transaction available in plain `pre` function')
          return 'ok'
        },
        [
          {
            method: function nested() {
              assert.ok(agent.getTransaction(), 'transaction available in nested `pre` function')
              return 'ok'
            }
          },
          {
            assign: 'pre3',
            method: function nested2() {
              assert.ok(
                agent.getTransaction(),
                'transaction available in 2nd nested `pre` function'
              )
              return 'ok'
            }
          }
        ]
      ],
      handler: function (req) {
        assert.ok(agent.getTransaction(), 'transaction is available in final handler')
        return { status: req.pre.pre3 }
      }
    }
  }
  server.route(route)

  server.start().then(function () {
    const port = server.info.port
    const uri = 'http://localhost:' + port + '/test/31337'
    helper.makeGetRequest(uri, {}, function (_error, res, body) {
      assert.equal(res.statusCode, 200, 'nothing exploded')
      assert.deepStrictEqual(body, { status: 'ok' }, 'got expected response')
      end()
    })
  })
})

test('using custom handler type', (t, end) => {
  const { agent, server } = t.nr
  agent.on('transactionFinished', verifier())

  server.decorate('handler', 'hello', function () {
    return function customHandler() {
      assert.ok(agent.getTransaction(), 'transaction is available')
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
    const port = server.info.port
    const uri = 'http://localhost:' + port + '/test/31337'
    helper.makeGetRequest(uri, {}, function (_error, res, body) {
      assert.equal(res.statusCode, 200, 'nothing exploded')
      assert.deepStrictEqual(body, { status: 'ok' }, 'got expected response')
      end()
    })
  })
})

/*
 * This test covers the use case of placing defaults on the handler
 * function.
 * for example: https://github.com/hapijs/h2o2/blob/v6.0.1/lib/index.js#L189-L198
 */
test('using custom handler defaults', (t, end) => {
  const { agent, server } = t.nr
  agent.on('transactionFinished', verifier('POST'))

  function handler(route) {
    assert.equal(route.settings.payload.parse, false, 'should set the payload parse setting')
    assert.equal(route.settings.payload.output, 'stream', 'should set the payload output setting')

    return function customHandler() {
      assert.ok(agent.getTransaction(), 'transaction is available')
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
    const port = server.info.port
    const uri = 'http://localhost:' + port + '/test/31337'
    helper.makeRequest(uri, { method: 'POST' }, function (_error, res, body) {
      assert.equal(res.statusCode, 200, 'nothing exploded')
      assert.deepStrictEqual(body, { status: 'ok' }, 'got expected response')
      end()
    })
  })
})

test('404 transaction is named correctly', (t, end) => {
  const { agent, server } = t.nr
  agent.on('transactionFinished', function (tx) {
    assert.equal(
      tx.trace.root.children[0].name,
      'WebTransaction/Nodejs/GET/(not found)',
      '404 segment has standardized name'
    )
  })

  server.start().then(function () {
    const port = server.info.port
    const uri = 'http://localhost:' + port + '/test'
    helper.makeGetRequest(uri, {}, function (_error, res, body) {
      assert.equal(res.statusCode, 404, 'nonexistent route was not found')
      assert.deepStrictEqual(
        body,
        { statusCode: 404, error: 'Not Found', message: 'Not Found' },
        'got expected response'
      )
      end()
    })
  })
})

test('using shared `pre` config option', (t, end) => {
  const { agent, server } = t.nr
  agent.on('transactionFinished', (transaction) => {
    assert.equal(
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
    const port = server.info.port
    const uri = 'http://localhost:' + port + '/first/123/second/456/data'
    helper.makeGetRequest(uri, {}, function (_error, res, body) {
      assert.equal(res.statusCode, 200, 'nothing exploded')
      assert.deepStrictEqual(body, { success: 'TRUE' }, 'got expected response')
      end()
    })
  })
})
