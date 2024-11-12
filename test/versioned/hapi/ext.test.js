/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const utils = require('./hapi-utils')

// Queue that executes outside of a transaction context
const tasks = []
const intervalId = setInterval(function () {
  while (tasks.length) {
    const task = tasks.pop()
    task()
  }
}, 10)

function addRouteAndGet(ctx, end) {
  const { agent, server } = ctx
  server.route({
    method: 'GET',
    path: '/test',
    handler: function myHandler() {
      assert.ok(agent.getTransaction(), 'transaction is available in route handler')
      return 'ok'
    }
  })

  server
    .start()
    .then(function () {
      const port = server.info.port
      helper.makeGetRequest('http://localhost:' + port + '/test', function () {
        end()
      })
    })
    .catch(function (err) {
      assert.ifError(err, 'should not fail to start server and request')
      end()
    })
}

function resolveOutOfScope(val) {
  return new Promise(function (resolve) {
    tasks.push(function () {
      resolve(val)
    })
  })
}

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

test.after(() => {
  clearInterval(intervalId)
})

test('keeps context with a single handler', (t, end) => {
  const { agent, server } = t.nr
  server.ext('onRequest', function (req, h) {
    assert.ok(agent.getTransaction(), 'transaction is available in onRequest handler')
    return resolveOutOfScope(h.continue)
  })

  addRouteAndGet(t.nr, end)
})

test('keeps context with a handler object with a single method', (t, end) => {
  const { agent, server } = t.nr

  server.ext({
    type: 'onRequest',
    method: function (req, h) {
      assert.ok(agent.getTransaction(), 'transaction is available in onRequest handler')
      return resolveOutOfScope(h.continue)
    }
  })

  addRouteAndGet(t.nr, end)
})

test('keeps context with a handler object with an array of methods', (t, end) => {
  const { agent, server } = t.nr

  server.ext({
    type: 'onRequest',
    method: [
      function (req, h) {
        assert.ok(agent.getTransaction(), 'transaction is available in first handler')
        return resolveOutOfScope(h.continue)
      },
      function (req, h) {
        assert.ok(agent.getTransaction(), 'transaction is available in second handler')
        return Promise.resolve(h.continue)
      }
    ]
  })

  addRouteAndGet(t.nr, end)
})

test('keeps context with an array of handlers and an array of methods', (t, end) => {
  const { agent, server } = t.nr

  server.ext([
    {
      type: 'onRequest',
      method: [
        function (req, h) {
          assert.ok(agent.getTransaction(), 'transaction is available in first handler')
          return resolveOutOfScope(h.continue)
        },
        function (req, h) {
          assert.ok(agent.getTransaction(), 'transaction is available in second handler')
          return Promise.resolve(h.continue)
        }
      ]
    },
    {
      type: 'onPreHandler',
      method: function (req, h) {
        assert.ok(agent.getTransaction(), 'transaction is available in third handler')
        return resolveOutOfScope(h.continue)
      }
    }
  ])

  addRouteAndGet(t.nr, end)
})

test('does not crash on non-request events', (t, end) => {
  const { agent, server } = t.nr

  server.ext('onPreStart', function (s) {
    assert.equal(agent.getTransaction(), undefined, 'should not have transaction in server events')
    assert.equal(s, server, 'should pass through arguments without change')
    return Promise.resolve()
  })

  addRouteAndGet(t.nr, end)
})
