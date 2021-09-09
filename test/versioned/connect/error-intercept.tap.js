/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const helper = require('../../lib/agent_helper')

// connect is a loudmouth without this
process.env.NODE_ENV = 'test'

test('intercepting errors with connect 2', function (t) {
  t.plan(3)

  t.test('should wrap handlers with proxies', function (t) {
    const agent = helper.instrumentMockedAgent()
    const connect = require('connect')
    const app = connect()

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    function nop() {}

    app.use(nop)

    t.ok(app.stack, "there's a stack of handlers defined")
    // 2 because of the error handler
    t.equal(app.stack.length, 1, 'have test middleware + error interceptor')

    const wrapNop = app.stack[0]
    t.equal(wrapNop.route, '', 'nop handler defaults to all routes')
    t.ok(wrapNop.handle, 'have nop handle passed above')
    t.equal(wrapNop.handle.name, 'nop', "nop's name is unchanged")
    t.equal(wrapNop.handle.__NR_original, nop, 'nop is wrapped')

    t.end()
  })

  t.test('should have only one error interceptor in the middleware stack', function (t) {
    const agent = helper.instrumentMockedAgent()
    const connect = require('connect')
    const app = connect()

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    app.use(function first() {})
    t.equal(app.stack.length, 1, '1 handlers after 1st add')

    app.use(function second() {})
    t.equal(app.stack.length, 2, '2 handlers after 2nd add')

    app.use(function third() {})
    t.equal(app.stack.length, 3, '3 handlers after 3rd add')

    app.use(function fourth() {})
    t.equal(app.stack.length, 4, '4 handlers after 4th add')

    t.end()
  })

  t.test('should trace errors that occur while executing a middleware', function (t) {
    const agent = helper.instrumentMockedAgent()
    let server
    agent.once('transactionFinished', function () {
      const errors = agent.errors.traceAggregator.errors // FIXME: redundancy is dumb
      t.equal(errors.length, 1, 'the error got traced')

      const error = errors[0]
      t.equal(error.length, 5, 'format for traced error is correct')
      t.equal(error[3], 'TypeError', 'got the correct class for the error')

      server.close()
      t.end()
    })

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    helper.runInTransaction(agent, function () {
      const connect = require('connect')
      const app = connect()

      function wiggleware(req, res, next) {
        const harbl = null
        harbl.bargl() // OHHH NOOOOO

        return next() // will never get here
      }

      app.use(wiggleware)

      const http = require('http')
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
            function onResponse(res) {
              res.on('data', function () {
                // throw away the data
              })
            }
          )
          req.end()
        })
    })
  })
})
