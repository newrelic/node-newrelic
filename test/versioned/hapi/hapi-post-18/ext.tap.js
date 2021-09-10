/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const request = require('request')
const tap = require('tap')
const helper = require('../../../lib/agent_helper')
const utils = require('./hapi-18-utils')

tap.test('Hapi v17 ext', function (t) {
  t.autoend()

  let agent = null
  let server = null
  let port = null

  // Queue that executes outside of a transaction context
  const tasks = []
  const intervalId = setInterval(function () {
    while (tasks.length) {
      const task = tasks.pop()
      task()
    }
  }, 10)
  function resolveOutOfScope(val) {
    return new Promise(function (resolve) {
      tasks.push(function () {
        resolve(val)
      })
    })
  }

  t.teardown(function () {
    clearInterval(intervalId)
  })

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent()

    server = utils.getServer()
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    return server.stop()
  })

  t.test('keeps context with a single handler', function (t) {
    server.ext('onRequest', function (req, h) {
      t.ok(agent.getTransaction(), 'transaction is available in onRequest handler')
      return resolveOutOfScope(h.continue)
    })

    addRouteAndGet(t)
  })

  t.test('keeps context with a handler object with a single method', function (t) {
    server.ext({
      type: 'onRequest',
      method: function (req, h) {
        t.ok(agent.getTransaction(), 'transaction is available in onRequest handler')
        return resolveOutOfScope(h.continue)
      }
    })

    addRouteAndGet(t)
  })

  t.test('keeps context with a handler object with an array of methods', function (t) {
    server.ext({
      type: 'onRequest',
      method: [
        function (req, h) {
          t.ok(agent.getTransaction(), 'transaction is available in first handler')
          return resolveOutOfScope(h.continue)
        },
        function (req, h) {
          t.ok(agent.getTransaction(), 'transaction is available in second handler')
          return Promise.resolve(h.continue)
        }
      ]
    })

    addRouteAndGet(t)
  })

  t.test('keeps context with an array of handlers and an array of methods', function (t) {
    server.ext([
      {
        type: 'onRequest',
        method: [
          function (req, h) {
            t.ok(agent.getTransaction(), 'transaction is available in first handler')
            return resolveOutOfScope(h.continue)
          },
          function (req, h) {
            t.ok(agent.getTransaction(), 'transaction is available in second handler')
            return Promise.resolve(h.continue)
          }
        ]
      },
      {
        type: 'onPreHandler',
        method: function (req, h) {
          t.ok(agent.getTransaction(), 'transaction is available in third handler')
          return resolveOutOfScope(h.continue)
        }
      }
    ])

    addRouteAndGet(t)
  })

  t.test('does not crash on non-request events', function (t) {
    server.ext('onPreStart', function (s) {
      t.notOk(agent.getTransaction(), 'should not have transaction in server events')
      t.equal(s, server, 'should pass through arguments without change')
      return Promise.resolve()
    })

    addRouteAndGet(t)
  })

  function addRouteAndGet(t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function myHandler() {
        t.ok(agent.getTransaction(), 'transaction is available in route handler')
        return 'ok'
      }
    })

    server
      .start()
      .then(function () {
        port = server.info.port
        request.get('http://localhost:' + port + '/test', function () {
          t.end()
        })
      })
      .catch(function (err) {
        t.error(err, 'should not fail to start server and request')
        t.end()
      })
  }
})
