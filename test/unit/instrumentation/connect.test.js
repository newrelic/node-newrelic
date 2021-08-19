/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable strict */

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const WebShim = require('../../../lib/shim/webframework-shim')

function nextulator(req, res, next) {
  return next()
}

tap.test('an instrumented Connect stack', function (t) {
  t.autoend()

  t.test("shouldn't cause bootstrapping to fail", function (t) {
    // testing some stuff further down that needs to be non-strict
    'use strict'

    t.autoend()
    let agent
    let initialize
    let shim

    t.before(function () {
      agent = helper.loadMockedAgent()
      shim = new WebShim(agent, 'connect')
      initialize = require('../../../lib/instrumentation/connect')
    })

    t.teardown(function () {
      helper.unloadAgent(agent)
    })

    t.test('when passed no module', function (t) {
      t.doesNotThrow(() => {
        initialize(agent, null, 'connect', shim)
      })
      t.end()
    })

    t.test('when passed an empty module', function (t) {
      t.doesNotThrow(() => {
        initialize(agent, {}, 'connect', shim)
      })
      t.end()
    })
  })

  t.test('for Connect 1 (stubbed)', function (t) {
    t.autoend()
    let agent
    let stub
    let app
    let shim

    t.beforeEach(function () {
      agent = helper.instrumentMockedAgent()

      stub = {
        version: '1.0.1',
        HTTPServer: {
          prototype: {
            use: function (route, middleware) {
              if (this.stack && typeof middleware === 'function') {
                this.stack.push({ route: route, handle: middleware })
              } else if (this.stack && typeof route === 'function') {
                this.stack.push({ route: '', handle: route })
              }

              return this
            }
          }
        }
      }

      shim = new WebShim(agent, 'connect')
      require('../../../lib/instrumentation/connect')(agent, stub, 'connect', shim)

      app = stub.HTTPServer.prototype
    })

    t.afterEach(function () {
      helper.unloadAgent(agent)
    })

    t.test("shouldn't throw if there's no middleware chain", function (t) {
      t.doesNotThrow(() => {
        app.use.call(app, nextulator)
      })
      t.end()
    })

    t.test("shouldn't throw if there's a middleware link with no handler", function (t) {
      app.stack = []

      t.doesNotThrow(function () {
        app.use.call(app, '/')
      })
      t.end()
    })

    t.test(
      "shouldn't throw if there's a middleware link with a non-function handler",
      function (t) {
        app.stack = []

        t.doesNotThrow(function () {
          app.use.call(app, '/', 'hamburglar')
        })
        t.end()
      }
    )

    t.test("shouldn't break use", function (t) {
      function errulator(err, req, res, next) {
        return next(err)
      }

      app.stack = []

      app.use.call(app, '/', nextulator)
      app.use.call(app, '/test', nextulator)
      app.use.call(app, '/error1', errulator)
      app.use.call(app, '/help', nextulator)
      app.use.call(app, '/error2', errulator)

      t.equal(app.stack.length, 5)
      t.end()
    })

    t.test("shouldn't barf on functions with ES5 future reserved keyword names", function (t) {
      // doin this on porpoise
      /* eslint-disable */
      function static(req, res, next) {
        return next()
      }

      app.stack = []

      t.doesNotThrow(function () { app.use.call(app, '/', static); })
      t.end()
    })
  })

  t.test("for Connect 2 (stubbed)", function (t) {
    t.autoend()

    let agent
    let stub
    let app
    let shim


    t.beforeEach(function () {
      agent = helper.instrumentMockedAgent()

      stub = {
        version : '2.7.2',
        proto : {
          use : function (route, middleware) {
            if (this.stack && typeof middleware === 'function') {
              this.stack.push({route : route, handle : middleware})
            }
            else if (this.stack && typeof route === 'function') {
              this.stack.push({route : '', handle : route})
            }

            return this
          }
        }
      }

      shim = new WebShim(agent, 'connect')
      require('../../../lib/instrumentation/connect')(agent, stub, 'connect', shim)

      app = stub.proto
    })

    t.afterEach(function () {
      helper.unloadAgent(agent)
    })

    t.test("shouldn't throw if there's no middleware chain", function (t) {
      const app = stub.proto
      t.doesNotThrow(function () { app.use.call(app, nextulator); })
      t.end()
    })

    t.test("shouldn't throw if there's a middleware link with no handler", function (t) {
      app.stack = []

      t.doesNotThrow(function () { app.use.call(app, '/'); })
      t.end()
    })

    t.test("shouldn't throw if there's a middleware link with a non-function handler", function (t) {
      app.stack = []

      t.doesNotThrow(function () { app.use.call(app, '/', 'hamburglar'); })
      t.end()
    })

    t.test("shouldn't break use", function (t) {
      function errulator(err, req, res, next) {
        return next(err)
      }

      app.stack = []

      app.use.call(app, '/', nextulator)
      app.use.call(app, '/test', nextulator)
      app.use.call(app, '/error1', errulator)
      app.use.call(app, '/help', nextulator)
      app.use.call(app, '/error2', errulator)

      t.equal(app.stack.length, 5)
      t.end()
    })

    t.test("shouldn't barf on functions with ES5 future reserved keyword names", function (t) {
      // doin this on porpoise
      function static(req, res, next) {
        return next()
      }

      app.stack = []

      t.doesNotThrow(function () { app.use.call(app, '/', static); })
      t.end()
    })
  })
})

/* eslint-enable strict */
