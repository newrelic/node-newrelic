/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const WebShim = require('../../../lib/shim/webframework-shim')

function nextulator(req, res, next) {
  return next()
}

test("shouldn't cause bootstrapping to fail", async function (t) {
  // only enabled strict on this test suite
  // the suites that have tests with a function static
  // would get a syntax error if `use strict` was declared
  'use strict'

  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.shim = new WebShim(agent, 'connect')
    ctx.nr.initialize = require('../../../lib/instrumentation/connect')
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('when passed no module', async function (t) {
    const { agent, initialize, shim } = t.nr
    assert.doesNotThrow(() => {
      initialize(agent, null, 'connect', shim)
    })
  })

  await t.test('when passed an empty module', async function (t) {
    const { agent, initialize, shim } = t.nr
    assert.doesNotThrow(() => {
      initialize(agent, {}, 'connect', shim)
    })
  })
})

test('for Connect 1 (stubbed)', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    const agent = helper.instrumentMockedAgent()

    const stub = {
      version: '1.0.1',
      HTTPServer: {
        prototype: {
          use: function (route, middleware) {
            if (this.stack && typeof middleware === 'function') {
              this.stack.push({ route, handle: middleware })
            } else if (this.stack && typeof route === 'function') {
              this.stack.push({ route: '', handle: route })
            }

            return this
          }
        }
      }
    }

    const shim = new WebShim(agent, 'connect')
    require('../../../lib/instrumentation/connect')(agent, stub, 'connect', shim)

    ctx.nr.app = stub.HTTPServer.prototype
    ctx.nr.agent = agent
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test("shouldn't throw if there's no middleware chain", async function (t) {
    const { app } = t.nr
    assert.doesNotThrow(() => {
      app.use(nextulator)
    })
  })

  await t.test("shouldn't throw if there's a middleware link with no handler", async function (t) {
    const { app } = t.nr
    app.stack = []

    assert.doesNotThrow(function () {
      app.use('/')
    })
  })

  await t.test(
    "shouldn't throw if there's a middleware link with a non-function handler",
    async function (t) {
      const { app } = t.nr
      app.stack = []

      assert.doesNotThrow(function () {
        app.use('/', 'hamburglar')
      })
    }
  )

  await t.test("shouldn't break use", async function (t) {
    const { app } = t.nr
    function errulator(err, req, res, next) {
      return next(err)
    }

    app.stack = []

    app.use('/', nextulator)
    app.use('/test', nextulator)
    app.use('/error1', errulator)
    app.use('/help', nextulator)
    app.use('/error2', errulator)

    assert.equal(app.stack.length, 5)
  })

  await t.test(
    "shouldn't barf on functions with ES5 future reserved keyword names",
    async function (t) {
      // We are using a `new Function` here to get around:
      // https://github.com/eslint/eslint/issues/19251
      const { app } = t.nr
      const fn = new Function('function static(req, res, next) { return next() }')
      app.stack = []
      assert.doesNotThrow(function () { app.use('/', fn) })
    }
  )
})

test('for Connect 2 (stubbed)', async function(t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    const agent = helper.instrumentMockedAgent()

    const stub = {
      version: '2.7.2',
      proto: {
        use: function (route, middleware) {
          if (this.stack && typeof middleware === 'function') {
            this.stack.push({ route, handle: middleware })
          } else if (this.stack && typeof route === 'function') {
            this.stack.push({ route: '', handle: route })
          }

          return this
        }
      }
    }

    const shim = new WebShim(agent, 'connect')
    require('../../../lib/instrumentation/connect')(agent, stub, 'connect', shim)

    ctx.nr.app = stub.proto
    ctx.nr.agent = agent
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test("shouldn't throw if there's no middleware chain", async function(t) {
    const { app } = t.nr
    assert.doesNotThrow(function () { app.use(nextulator) })
  })

  await t.test("shouldn't throw if there's a middleware link with no handler", async function(t) {
    const { app } = t.nr
    app.stack = []

    assert.doesNotThrow(function () { app.use('/') })
  })

  await t.test("shouldn't throw if there's a middleware link with a non-function handler", async function(t) {
    const { app } = t.nr
    app.stack = []

    assert.doesNotThrow(function () { app.use('/', 'hamburglar') })
  })

  await t.test("shouldn't break use", async function(t) {
    const { app } = t.nr
    function errulator(err, req, res, next) {
      return next(err)
    }

    app.stack = []

    app.use('/', nextulator)
    app.use('/test', nextulator)
    app.use('/error1', errulator)
    app.use('/help', nextulator)
    app.use('/error2', errulator)

    assert.equal(app.stack.length, 5)
  })

  await t.test("shouldn't barf on functions with ES5 future reserved keyword names", async function(t) {
    // We are using a `new Function` here to get around:
    // https://github.com/eslint/eslint/issues/19251
    const { app } = t.nr
    const fn = new Function('function static(req, res, next) { return next() }')
    app.stack = []
    assert.doesNotThrow(function () { app.use('/', fn) })
  })
})
