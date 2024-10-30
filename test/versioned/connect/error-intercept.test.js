/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const http = require('node:http')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const symbols = require('../../../lib/symbols')

// Connect logs stack traces if NODE_ENV is not set to "test"
process.env.NODE_ENV = 'test'

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  ctx.nr.connect = require('connect')
  ctx.nr.app = ctx.nr.connect()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['connect'])
})

test('should wrap handlers with proxies', (t) => {
  const { app } = t.nr

  function nop() {}
  app.use(nop)

  assert.ok(app.stack, 'there is a stack of handlers defined')
  assert.equal(app.stack.length, 1, 'have test middleware + error interceptor')

  const wrapNop = app.stack[0]
  assert.equal(wrapNop.route, '', 'nop handler defaults to all routes')
  assert.ok(wrapNop.handle, 'have nop handle passed above')
  assert.equal(wrapNop.handle.name, 'nop', 'nop name is unchanged')
  assert.equal(wrapNop.handle[symbols.original], nop, 'nop is wrapped')
})

test('should have only one error interceptor in the middleware stack', (t) => {
  const { app } = t.nr

  app.use(function first() {})
  assert.equal(app.stack.length, 1, '1 handlers after first add')

  app.use(function second() {})
  assert.equal(app.stack.length, 2, '2 handlers after second add')

  app.use(function third() {})
  assert.equal(app.stack.length, 3, '3 handlers after third add')

  app.use(function fourth() {})
  assert.equal(app.stack.length, 4, '4 handlers after fourth add')
})

test('should trace errors that occur while executing middleware', (t, end) => {
  const { agent, app } = t.nr
  let server

  agent.once('transactionFinished', () => {
    const errors = agent.errors.traceAggregator.errors
    assert.equal(errors.length, 1, 'the error got traced')

    const error = errors[0]
    assert.equal(error.length, 6, 'format for traced error is correct')
    assert.equal(error[3], 'TypeError', 'got the correct class for the error')

    server.close()
    end()
  })

  helper.runInTransaction(agent, () => {
    function wiggleware(req, res, next) {
      const harbl = null
      harbl.bargl() // Induce error.

      return next() // Will never get here.
    }

    app.use(wiggleware)

    server = http
      .createServer(function (req, res) {
        app.handle(req, res)
      })
      .listen(0, function () {
        const req = http.request(
          {
            port: server.address().port,
            host: 'localhost',
            path: '/asdf',
            method: 'GET'
          },
          (res) => {
            res.on('data', () => {})
          }
        )
        req.end()
      })
  })
})
