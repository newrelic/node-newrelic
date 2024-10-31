/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')
const WebFrameworkShim = require('../../../lib/shim/webframework-shim')
const symbols = require('../../../lib/symbols')
const { MiddlewareSpec, RenderSpec } = require('../../../lib/shim/specs')
const tsplan = require('@matteo.collina/tspl')

function createMiddleware({ ctx, path }) {
  const { txInfo, shim } = ctx.nr
  const unwrappedTimeout = shim.unwrap(setTimeout)
  return function middleware(_req, err, next) {
    ctx.nr.segment = shim.getSegment()
    return new Promise(function (resolve, reject) {
      unwrappedTimeout(function () {
        try {
          assert.equal(txInfo.transaction.nameState.getPath(), path)
          if (next) {
            return next().then(
              function () {
                assert.equal(txInfo.transaction.nameState.getPath(), path)
                resolve()
              },
              function (err) {
                assert.equal(txInfo.transaction.nameState.getPath(), '/')

                if (err && err.name === 'AssertionError') {
                  // Reject assertion errors from promises to fail the test
                  reject(err)
                } else {
                  // Resolve for errors purposely triggered for tests.
                  resolve()
                }
              }
            )
          }
          if (err) {
            throw err
          } else {
            resolve()
          }
        } catch (e) {
          reject(err)
        }
      }, 20)
    })
  }
}

test('WebFrameworkShim', async function (t) {
  function beforeEach(ctx) {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    const shim = new WebFrameworkShim(agent, 'test-restify')
    shim.setFramework(WebFrameworkShim.RESTIFY)
    ctx.nr.wrappable = {
      name: 'this is a name',
      bar: function barsName(unused, params) { return 'bar' }, // eslint-disable-line
      fiz: function fizsName() {
        return 'fiz'
      },
      anony: function () {},
      middleware: function (_req, res, next) {
        return { req: _req, res, next, segment: agent.tracer.getSegment() }
      },
      getActiveSegment: function getActiveSegment() {
        return agent.tracer.getSegment()
      }
    }

    const txInfo = {
      transaction: null,
      segmentStack: [],
      errorHandled: false,
      error: null
    }
    ctx.nr.req = { [symbols.transactionInfo]: txInfo, params: { foo: 'bar', biz: 'bang' } }
    ctx.nr.agent = agent
    ctx.nr.shim = shim
    ctx.nr.txInfo = txInfo
  }

  function afterEach(ctx) {
    helper.unloadAgent(ctx.nr.agent)
  }

  await t.test('constructor', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should inherit from Shim', function (t) {
      const { shim } = t.nr
      assert.ok(shim instanceof WebFrameworkShim)
      assert.ok(shim instanceof Shim)
    })
    await t.test('should require the `agent` parameter', function () {
      assert.throws(function () {
        return new WebFrameworkShim()
      }, 'Error: Shim must be initialized with agent and module name')
    })

    await t.test('should require the `moduleName` parameter', function (t) {
      const { agent } = t.nr
      assert.throws(function () {
        return new WebFrameworkShim(agent)
      }, 'Error: Shim must be initialized with agent and module name')
    })

    await t.test('should assign properties from parent', (t) => {
      const { agent } = t.nr
      const mod = 'test-mod'
      const name = mod
      const version = '1.0.0'
      const shim = new WebFrameworkShim(agent, mod, mod, name, version)
      assert.equal(shim.moduleName, mod)
      assert.equal(agent, shim._agent)
      assert.equal(shim.pkgVersion, version)
    })
  })

  await t.test('enumerations', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should enumerate well-known frameworks on the class and prototype', function (t) {
      const { shim } = t.nr
      const frameworks = ['CONNECT', 'DIRECTOR', 'EXPRESS', 'HAPI', 'RESTIFY']
      frameworks.forEach(function (fw) {
        assert.ok(WebFrameworkShim[fw])
        assert.ok(shim[fw])
      })
    })

    await t.test('should enumerate middleware types on the class and prototype', function (t) {
      const { shim } = t.nr
      const types = ['MIDDLEWARE', 'APPLICATION', 'ROUTER', 'ROUTE', 'ERRORWARE', 'PARAMWARE']
      types.forEach(function (type) {
        assert.ok(WebFrameworkShim[type])
        assert.ok(shim[type])
      })
    })
  })

  await t.test('#logger', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should be a non-writable property', function (t) {
      const { shim } = t.nr
      assert.throws(function () {
        shim.logger = 'foobar'
      })

      assert.notDeepEqual(shim.logger, 'foobar')
    })

    await t.test('should be a logger to use with the shim', function (t) {
      const { shim } = t.nr
      assert.ok(shim.logger.trace instanceof Function)
      assert.ok(shim.logger.debug instanceof Function)
      assert.ok(shim.logger.info instanceof Function)
      assert.ok(shim.logger.warn instanceof Function)
      assert.ok(shim.logger.error instanceof Function)
    })
  })

  await t.test('#setRouteParser', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should set the function used to parse routes', function (t) {
      const { shim, wrappable } = t.nr
      let called = false
      shim.setRouteParser(function (shim, fn, fnName, route) {
        called = true
        assert.equal(route, '/foo/bar')
        return route
      })

      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: shim.FIRST,
        wrapper: function (shim, middleware) {
          return middleware
        }
      })

      wrappable.bar('/foo/bar', function () {})
      assert.equal(called, true)
    })
  })

  await t.test('#setFramework', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { agent } = ctx.nr
      // Use a shim without a datastore set for these tests.
      ctx.nr.shim = new WebFrameworkShim(agent, 'test-cassandra')
    })
    t.afterEach(afterEach)

    await t.test('should accept the id of a well-known framework', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.setFramework(shim.RESTIFY)
      })

      assert.equal(shim._metrics.PREFIX, 'Restify/')
    })

    await t.test('should create custom metric names if the `framework` is a string', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(function () {
        shim.setFramework('Fake Web Framework')
      })

      assert.equal(shim._metrics.PREFIX, 'Fake Web Framework/')
    })

    await t.test("should update the shim's logger", function (t) {
      const { shim } = t.nr
      const original = shim.logger
      shim.setFramework(shim.RESTIFY)
      assert.notEqual(shim.logger, original)
      assert.equal(shim.logger.extra.framework, 'Restify')
    })

    await t.test('should set the Framework environment setting', function (t) {
      const { agent, shim } = t.nr
      const env = agent.environment
      env.clearFramework()
      shim.setFramework(shim.RESTIFY)
      assert.deepEqual(env.get('Framework'), ['Restify'])
    })
  })

  await t.test('#wrapMiddlewareMounter', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.wrapMiddlewareMounter(wrappable, {})
      assert.equal(wrapped, wrappable)
      assert.equal(shim.isWrapped(wrapped), false)
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.wrapMiddlewareMounter(wrappable.bar, {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.wrapMiddlewareMounter(wrappable.bar, null, {})
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.wrapMiddlewareMounter(wrappable, 'bar', {})
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.wrapMiddlewareMounter(wrappable, 'name', {})
      assert.equal(shim.isWrapped(wrappable.name), false)
    })

    await t.test('should call the middleware method for each function parameter', function (t) {
      const { shim, wrappable } = t.nr
      let callCount = 0
      const args = [function a() {}, function b() {}, function c() {}]

      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        wrapper: function (shim, fn, name) {
          assert.equal(fn, args[callCount])
          assert.equal(name, args[callCount].name)
          ++callCount
        }
      })

      wrappable.bar.apply(wrappable, args)

      assert.equal(callCount, args.length)
    })

    await t.test('should call the original function with the wrapped middleware', function (t) {
      const { shim } = t.nr
      let originalCallCount = 0
      let wrapperCallCount = 0

      const wrapped = shim.wrapMiddlewareMounter(
        function (a, b, c) {
          ++originalCallCount
          assert.equal(a, 1)
          assert.equal(b, 2)
          assert.equal(c, 3)
        },
        {
          wrapper: function () {
            return ++wrapperCallCount
          }
        }
      )

      wrapped(
        function () {},
        function () {},
        function () {}
      )
      assert.equal(originalCallCount, 1)
      assert.equal(wrapperCallCount, 3)
    })

    await t.test('should pass the route to the middleware wrapper', function (t) {
      const { shim, wrappable } = t.nr
      const realRoute = '/my/great/route'
      let callCount = 0
      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: shim.FIRST,
        wrapper: function (shim, fn, name, route) {
          assert.equal(route, realRoute)
          ++callCount
        }
      })

      wrappable.bar(realRoute, function () {})
      assert.equal(callCount, 1)
    })

    await t.test('should pass an array of routes to the middleware wrapper', (t) => {
      const { shim, wrappable } = t.nr
      const routes = ['/my/great/route', '/another/great/route']
      let callCount = 0
      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: shim.FIRST,
        wrapper: (shim, fn, name, route) => {
          assert.deepEqual(route, routes)
          ++callCount
        }
      })

      wrappable.bar(routes, () => {})
      assert.equal(callCount, 1)
    })

    await t.test('should not overwrite regex entries in the array of routes', (t) => {
      const { shim, wrappable } = t.nr
      const routes = [/a\/b\/$/, /anotherRegex/, /a/]
      let callCount = 0
      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: shim.FIRST,
        wrapper: () => {
          routes.forEach((r) => {
            assert.ok(r instanceof RegExp)
            ++callCount
          })
        }
      })

      wrappable.bar(routes, () => {})
      assert.equal(callCount, 3)
    })

    await t.test('should pass null if the route parameter is a middleware', function (t) {
      const { shim, wrappable } = t.nr
      let callCount = 0
      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: shim.FIRST,
        wrapper: function (shim, fn, name, route) {
          assert.equal(route, null)
          ++callCount
        }
      })

      wrappable.bar(
        function () {},
        function () {}
      )
      assert.equal(callCount, 2)
    })

    await t.test('should pass null if the spec says there is no route', function (t) {
      const { shim, wrappable } = t.nr
      let callCount = 0
      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: null,
        wrapper: function (shim, fn, name, route) {
          assert.equal(route, null)
          ++callCount
        }
      })

      wrappable.bar(
        function () {},
        function () {}
      )
      assert.equal(callCount, 2)
    })

    await t.test('should iterate through the contents of the array', function (t) {
      const { shim, wrappable } = t.nr
      let callCount = 0
      const funcs = [function a() {}, function b() {}, function c() {}]
      const args = [[funcs[0], funcs[1]], funcs[2]]

      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        wrapper: function (shim, fn, name) {
          assert.equal(fn, funcs[callCount])
          assert.equal(name, funcs[callCount].name)
          ++callCount
        }
      })

      wrappable.bar.apply(wrappable, args)

      assert.equal(funcs.length, callCount)
    })

    await t.test('should iterate through the contents of nested arrays too', function (t) {
      const { shim, wrappable } = t.nr
      let callCount = 0
      const funcs = [function a() {}, function b() {}, function c() {}]
      const args = [[[[[funcs[0], [[funcs[1]]]]], funcs[2]]]]

      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        wrapper: function (shim, fn, name) {
          assert.equal(fn, funcs[callCount])
          assert.equal(name, funcs[callCount].name)
          ++callCount
        }
      })

      wrappable.bar.apply(wrappable, args)

      assert.equal(funcs.length, callCount)
    })
  })

  await t.test('#recordMiddleware', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordMiddleware(wrappable, new MiddlewareSpec({}))
      assert.equal(wrapped, wrappable)
      assert.ok(!shim.isWrapped(wrapped))
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordMiddleware(wrappable.bar, new MiddlewareSpec({}))
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordMiddleware(wrappable.bar, null, new MiddlewareSpec({}))
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.recordMiddleware(wrappable, 'bar', new MiddlewareSpec({}))
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.recordMiddleware(wrappable, 'name', new MiddlewareSpec({}))
      assert.equal(shim.isWrapped(wrappable.name), false)
    })

    await t.test('should call the wrapped function', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      let called = false
      const wrapped = shim.recordMiddleware(function (_req, a, b, c) {
        called = true
        assert.equal(_req, req)
        assert.equal(a, 'a')
        assert.equal(b, 'b')
        assert.equal(c, 'c')
      }, new MiddlewareSpec({}))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        assert.equal(called, false)
        wrapped(req, 'a', 'b', 'c')
        assert.equal(called, true)
        end()
      })
    })

    await t.test(
      'should not affect transaction name state if type is errorware',
      function (t, end) {
        const { agent, req, shim, txInfo, wrappable } = t.nr
        testType(shim.ERRORWARE, 'Nodejs/Middleware/Restify/getActiveSegment//foo/bar')

        function testType(type, expectedName) {
          const wrapped = shim.recordMiddleware(
            wrappable.getActiveSegment,
            new MiddlewareSpec({
              type: type,
              route: '/foo/bar'
            })
          )
          helper.runInTransaction(agent, function (tx) {
            txInfo.transaction = tx
            sinon.spy(tx.nameState, 'appendPath')
            sinon.spy(tx.nameState, 'popPath')
            const segment = wrapped(req)

            assert.ok(!tx.nameState.appendPath.called)
            assert.ok(!tx.nameState.popPath.called)
            assert.equal(segment.name, expectedName)
            end()
          })
        }
      }
    )

    await t.test('should name the segment according to the middleware type', function (t) {
      const plan = tsplan(t, { plan: 6 })
      const { agent, req, shim, txInfo, wrappable } = t.nr
      testType(shim.MIDDLEWARE, 'Nodejs/Middleware/Restify/getActiveSegment//foo/bar')
      testType(shim.APPLICATION, 'Restify/Mounted App: /foo/bar')
      testType(shim.ROUTER, 'Restify/Router: /foo/bar')
      testType(shim.ROUTE, 'Restify/Route Path: /foo/bar')
      testType(shim.ERRORWARE, 'Nodejs/Middleware/Restify/getActiveSegment//foo/bar')
      testType(shim.PARAMWARE, 'Nodejs/Middleware/Restify/getActiveSegment//foo/bar')

      function testType(type, expectedName) {
        const wrapped = shim.recordMiddleware(
          wrappable.getActiveSegment,
          new MiddlewareSpec({
            type: type,
            route: '/foo/bar'
          })
        )
        helper.runInTransaction(agent, function (tx) {
          txInfo.transaction = tx
          const segment = wrapped(req)

          plan.equal(segment.name, expectedName)
        })
      }
    })

    await t.test('should not append a route if one is not given', function (t) {
      const plan = tsplan(t, { plan: 6 })
      const { agent, req, shim, txInfo, wrappable } = t.nr
      testType(shim.MIDDLEWARE, 'Nodejs/Middleware/Restify/getActiveSegment')
      testType(shim.APPLICATION, 'Restify/Mounted App: /')
      testType(shim.ROUTER, 'Restify/Router: /')
      testType(shim.ROUTE, 'Restify/Route Path: /')
      testType(shim.ERRORWARE, 'Nodejs/Middleware/Restify/getActiveSegment')
      testType(shim.PARAMWARE, 'Nodejs/Middleware/Restify/getActiveSegment')

      function testType(type, expectedName) {
        const wrapped = shim.recordMiddleware(
          wrappable.getActiveSegment,
          new MiddlewareSpec({
            type: type,
            route: ''
          })
        )
        helper.runInTransaction(agent, function (tx) {
          txInfo.transaction = tx
          const segment = wrapped(req)

          plan.equal(segment.name, expectedName)
        })
      }
    })

    await t.test('should not prepend root if the value is an array', function (t) {
      const plan = tsplan(t, { plan: 6 })
      const { agent, req, shim, txInfo, wrappable } = t.nr
      testType(shim.MIDDLEWARE, 'Nodejs/Middleware/Restify/getActiveSegment//one,/two')
      testType(shim.APPLICATION, 'Restify/Mounted App: /one,/two')
      testType(shim.ROUTER, 'Restify/Router: /one,/two')
      testType(shim.ROUTE, 'Restify/Route Path: /one,/two')
      testType(shim.ERRORWARE, 'Nodejs/Middleware/Restify/getActiveSegment//one,/two')
      testType(shim.PARAMWARE, 'Nodejs/Middleware/Restify/getActiveSegment//one,/two')

      function testType(type, expectedName) {
        const wrapped = shim.recordMiddleware(
          wrappable.getActiveSegment,
          new MiddlewareSpec({
            type: type,
            route: ['/one', '/two']
          })
        )
        helper.runInTransaction(agent, function (tx) {
          txInfo.transaction = tx
          const segment = wrapped(req)

          plan.equal(segment.name, expectedName)
        })
      }
    })

    await t.test('should capture route parameters when high_security is off', function (t, end) {
      const { agent, req, shim, txInfo, wrappable } = t.nr
      agent.config.high_security = false
      const wrapped = shim.recordMiddleware(
        wrappable.getActiveSegment,
        new MiddlewareSpec({
          type: shim.MIDDLEWARE,
          route: ['/one', '/two']
        })
      )
      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        const segment = wrapped(req)

        assert.ok(segment.attributes)
        const attrs = segment.getAttributes()
        assert.equal(attrs['request.parameters.route.foo'], 'bar')
        assert.equal(attrs['request.parameters.route.biz'], 'bang')
        const filePathSplit = attrs['code.filepath'].split('/')
        assert.equal(filePathSplit[filePathSplit.length - 1], 'webframework-shim.test.js')
        assert.equal(attrs['code.function'], 'getActiveSegment')
        assert.equal(attrs['code.lineno'], 74)
        assert.equal(attrs['code.column'], 50)
        end()
      })
    })

    await t.test('should not capture route parameters when high_security is on', function (t, end) {
      const { agent, req, shim, txInfo, wrappable } = t.nr
      agent.config.high_security = true
      const wrapped = shim.recordMiddleware(
        wrappable.getActiveSegment,
        new MiddlewareSpec({
          type: shim.MIDDLEWARE,
          route: ['/one', '/two']
        })
      )
      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        const segment = wrapped(req)

        assert.ok(segment.attributes)
        const attrs = Object.keys(segment.getAttributes())
        const requestParameters = /request\.parameters.*/

        assert.ok(!attrs.some((attr) => requestParameters.test(attr)))
        end()
      })
    })

    await t.test('should notice thrown exceptions', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordMiddleware(function () {
        throw new Error('foobar')
      }, new MiddlewareSpec({}))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        assert.throws(() => {
          wrapped(req)
        }, 'Error: foobar')

        assert.equal(txInfo.error, 'Error: foobar')
        assert.equal(txInfo.errorHandled, false)
        end()
      })
    })

    await t.test(
      'pops the name if error was thrown and there is no next handler',
      function (t, end) {
        const { agent, req, shim, txInfo } = t.nr
        const wrapped = shim.recordMiddleware(function () {
          throw new Error('foobar')
        }, new MiddlewareSpec({ route: '/foo/bar' }))

        helper.runInTransaction(agent, function (tx) {
          tx.nameState.appendPath('/')
          txInfo.transaction = tx
          assert.throws(() => {
            wrapped(req)
          })

          assert.equal(tx.nameState.getPath(), '/foo/bar')
          end()
        })
      }
    )

    await t.test(
      'does not pop the name if there was an error and a next handler',
      function (t, end) {
        const { agent, req, shim, txInfo } = t.nr
        const wrapped = shim.recordMiddleware(function () {
          throw new Error('foobar')
        }, new MiddlewareSpec({ route: '/foo/bar', next: shim.SECOND }))

        helper.runInTransaction(agent, function (tx) {
          tx.nameState.appendPath('/')
          txInfo.transaction = tx
          assert.throws(() => {
            wrapped(req, function () {})
          })

          assert.equal(tx.nameState.getPath(), '/foo/bar')
          end()
        })
      }
    )

    await t.test('should pop the namestate if there was no error', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordMiddleware(function () {},
      new MiddlewareSpec({ route: '/foo/bar' }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        wrapped(req)

        assert.equal(tx.nameState.getPath(), '/')
        end()
      })
    })

    await t.test('should pop the namestate if error is not an error', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordMiddleware(function (r, obj, next) {
        next(obj)
      }, new MiddlewareSpec({ route: '/foo/bar' }))

      const err = new Error()
      shim.setErrorPredicate(function (obj) {
        return obj === err
      })

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx

        wrapped(req, {}, function () {}) // Not an error!
        assert.equal(tx.nameState.getPath(), '/')

        wrapped(req, err, function () {}) // Error!
        assert.equal(tx.nameState.getPath(), '/foo/bar')
        end()
      })
    })
    await t.test('should notice errors handed to the callback', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordMiddleware(function (_req, next) {
        setTimeout(next, 10, new Error('foobar'))
      }, new MiddlewareSpec({ next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        wrapped(req, function (err) {
          assert.ok(err instanceof Error)
          assert.equal(err.message, 'foobar')

          assert.equal(txInfo.error, err)
          assert.equal(txInfo.errorHandled, false)
          end()
        })
      })
    })

    await t.test('should not pop the name if there was an error', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordMiddleware(function (_req, next) {
        setTimeout(next, 10, new Error('foobar'))
      }, new MiddlewareSpec({ route: '/foo/bar', next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        wrapped(req, function () {
          assert.equal(tx.nameState.getPath(), '/foo/bar')
          end()
        })
      })
    })

    await t.test('should pop the namestate if there was no error', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordMiddleware(function (_req, next) {
        setTimeout(function () {
          assert.equal(txInfo.transaction.nameState.getPath(), '/foo/bar')
          next()
        }, 10)
      }, new MiddlewareSpec({ route: '/foo/bar', next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        wrapped(req, function () {
          assert.equal(tx.nameState.getPath(), '/')
          end()
        })
      })
    })

    await t.test('should not append path and should not pop path', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const spec = new MiddlewareSpec({
        route: '/foo/bar',
        appendPath: false,
        next: shim.LAST
      })

      const wrapped = shim.recordMiddleware(function (_req, next) {
        setTimeout(function () {
          // verify did not append the path
          assert.equal(txInfo.transaction.nameState.getPath(), '/expected')
          next()
        }, 10)
      }, spec)

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        tx.nameState.appendPath('/expected')

        txInfo.transaction = tx
        wrapped(req, function () {
          // verify did not pop back to '/' from '/expected'
          assert.equal(tx.nameState.getPath(), '/expected')
          end()
        })
      })
    })

    await t.test('should mark the error as handled', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordMiddleware(function () {
        throw new Error('foobar')
      }, new MiddlewareSpec({}))

      const errorware = shim.recordMiddleware(
        function () {},
        new MiddlewareSpec({
          type: shim.ERRORWARE,
          req: shim.SECOND
        })
      )

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        try {
          wrapped(req)
        } catch (err) {
          assert.equal(txInfo.error, err)
          assert.equal(txInfo.errorHandled, false)

          errorware(err, req)
          assert.equal(txInfo.error, err)
          assert.equal(txInfo.errorHandled, true)
          end()
        }
      })
    })

    await t.test('should notice if the errorware errors', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordMiddleware(function () {
        throw new Error('foobar')
      }, new MiddlewareSpec({}))

      const errorware = shim.recordMiddleware(function () {
        throw new Error('errorware error')
      }, new MiddlewareSpec({ type: shim.ERRORWARE, req: shim.SECOND }))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        try {
          wrapped(req)
        } catch (err) {
          assert.equal(txInfo.error, err)
          assert.equal(txInfo.errorHandled, false)

          try {
            errorware(err, req)
          } catch (err2) {
            assert.equal(txInfo.error, err2)
            assert.equal(txInfo.errorHandled, false)
            end()
          }
        }
      })
    })
  })

  await t.test('#recordMiddleware when middleware returns a promise', async function (t) {
    t.beforeEach(function (ctx) {
      beforeEach(ctx)
      const { shim } = ctx.nr
      const middleware = createMiddleware({ ctx, path: '/foo/bar' })
      ctx.nr.wrapped = shim.recordMiddleware(
        middleware,
        new MiddlewareSpec({
          route: '/foo/bar',
          next: shim.LAST,
          promise: true
        })
      )
      ctx.nr.middleware = middleware
    })
    t.afterEach(afterEach)

    await t.test('should notice errors from rejected promises', async function (t) {
      const { agent, req, txInfo, wrapped } = t.nr
      return helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        return wrapped(req, new Error('foobar')).catch(function (err) {
          assert.ok(err instanceof Error)
          assert.equal(err.message, 'foobar')
          assert.equal(txInfo.error, err)
          assert.ok(!txInfo.errorHandled)

          assert.ok(t.nr.segment.timer.getDurationInMillis() > 18)
        })
      })
    })

    await t.test('should not pop the name if there was an error', async function (t) {
      const { agent, req, txInfo, wrapped } = t.nr
      return helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        return wrapped(req, new Error('foobar')).catch(function () {
          assert.equal(tx.nameState.getPath(), '/foo/bar')
          assert.ok(t.nr.segment.timer.getDurationInMillis() > 18)
        })
      })
    })

    await t.test('should pop the namestate if there was no error', async function (t) {
      const { agent, req, txInfo, wrapped } = t.nr
      return helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        return wrapped(req).then(function () {
          assert.equal(tx.nameState.getPath(), '/')
          assert.ok(t.nr.segment.timer.getDurationInMillis() > 18)
        })
      })
    })

    await t.test('should pop the name of the handler off when next is called', async function (t) {
      const { agent, req, txInfo, wrapped } = t.nr
      return helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        return wrapped(req, null, function next() {
          assert.equal(tx.nameState.getPath(), '/')
          return new Promise(function (resolve) {
            assert.equal(agent.tracer.getTransaction(), tx)
            resolve()
          })
        })
      })
    })

    await t.test('should have the right name when the next handler errors', async function (t) {
      const { agent, req, txInfo, wrapped } = t.nr
      return helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        return wrapped(req, null, function next() {
          assert.equal(tx.nameState.getPath(), '/')
          return new Promise(function (resolve, reject) {
            assert.equal(agent.tracer.getTransaction(), tx)
            reject()
          })
        })
      })
    })

    await t.test('should appropriately parent child segments in promise', async (t) => {
      const { agent, req, txInfo, wrapped } = t.nr
      return helper.runInTransaction(agent, (tx) => {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        return wrapped(req, null, () => {
          return new Promise((resolve) => {
            const _tx = agent.tracer.getTransaction()
            assert.equal(_tx, tx)
            assert.equal(_tx.nameState.getPath(), '/')

            const childSegment = _tx.agent.tracer.createSegment('childSegment')
            assert.equal(childSegment.parent.name, 'Nodejs/Middleware/Restify/middleware//foo/bar')

            resolve()
          })
        })
      })
    })
  })

  await t.test(
    '#recordMiddleware when middleware returns promise and spec.appendPath is false',
    async (t) => {
      t.beforeEach((ctx) => {
        beforeEach(ctx)
        ctx.nr.middleware = createMiddleware({ ctx, path: '/' })
      })
      t.afterEach(afterEach)

      await t.test('should not append path when spec.appendPath is false', async (t) => {
        const { agent, middleware, req, shim, txInfo } = t.nr
        const wrapped = shim.recordMiddleware(
          middleware,
          new MiddlewareSpec({
            route: '/foo/bar',
            appendPath: false,
            next: shim.LAST,
            promise: true
          })
        )
        return helper.runInTransaction(agent, (tx) => {
          tx.nameState.appendPath('/')
          txInfo.transaction = tx
          return wrapped(req, null, () => {
            assert.equal(tx.nameState.getPath(), '/')
            return new Promise((resolve) => {
              const _tx = agent.tracer.getTransaction()
              assert.equal(_tx, tx)
              assert.equal(_tx.nameState.getPath(), '/')
              resolve()
            })
          })
        })
      })
    }
  )

  await t.test('#recordParamware', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordParamware(wrappable, new MiddlewareSpec({}))
      assert.equal(wrapped, wrappable)
      assert.equal(shim.isWrapped(wrapped), false)
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordParamware(wrappable.bar, new MiddlewareSpec({}))
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordParamware(wrappable.bar, null, new MiddlewareSpec({}))
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.recordParamware(wrappable, 'bar', new MiddlewareSpec({}))
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.recordParamware(wrappable, 'name', new MiddlewareSpec({}))
      assert.equal(shim.isWrapped(wrappable.name), false)
    })

    await t.test('should call the wrapped function', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      let called = false
      const wrapped = shim.recordParamware(function (_req, a, b, c) {
        called = true
        assert.equal(_req, req)
        assert.equal(a, 'a')
        assert.equal(b, 'b')
        assert.equal(c, 'c')
      }, new MiddlewareSpec({}))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        assert.equal(called, false)
        wrapped(req, 'a', 'b', 'c')
        assert.equal(called, true)
        end()
      })
    })

    await t.test('should name the segment as a paramware', function (t, end) {
      const { agent, req, shim, wrappable, txInfo } = t.nr
      testType(shim.PARAMWARE, 'Nodejs/Middleware/Restify/getActiveSegment//[param handler :foo]')

      function testType(type, expectedName) {
        const wrapped = shim.recordParamware(
          wrappable.getActiveSegment,
          new MiddlewareSpec({
            type: type,
            name: 'foo'
          })
        )
        helper.runInTransaction(agent, function (tx) {
          txInfo.transaction = tx
          const segment = wrapped(req)

          assert.equal(segment.name, expectedName)
          end()
        })
      }
    })

    await t.test('should notice thrown exceptions', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordParamware(function () {
        throw new Error('foobar')
      }, new MiddlewareSpec({}))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        let err = null
        try {
          wrapped(req)
        } catch (e) {
          err = e
          assert.ok(e instanceof Error)
          assert.equal(e.message, 'foobar')
        }
        assert.equal(txInfo.error, err)
        assert.ok(!txInfo.errorHandled)
        end()
      })
    })

    await t.test('should not pop the name if there was an error', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordParamware(function () {
        throw new Error('foobar')
      }, new MiddlewareSpec({ name: 'bar' }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/foo/')
        txInfo.transaction = tx
        assert.throws(() => {
          wrapped(req)
        })

        assert.equal(tx.nameState.getPath(), '/foo/[param handler :bar]')
        end()
      })
    })

    await t.test('should pop the namestate if there was no error', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordParamware(function () {}, new MiddlewareSpec({ name: 'bar' }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/foo')
        txInfo.transaction = tx
        wrapped(req)

        assert.equal(tx.nameState.getPath(), '/foo')
        end()
      })
    })

    await t.test('should notice errors handed to the callback', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordParamware(function (_req, next) {
        setTimeout(next, 10, new Error('foobar'))
      }, new MiddlewareSpec({ next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        wrapped(req, function (err) {
          assert.ok(err instanceof Error)
          assert.equal(err.message, 'foobar')

          assert.equal(txInfo.error, err)
          assert.ok(!txInfo.errorHandled)
          end()
        })
      })
    })

    await t.test('should not pop the name if there was an error', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordParamware(function (_req, next) {
        setTimeout(next, 10, new Error('foobar'))
      }, new MiddlewareSpec({ name: 'bar', next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/foo')
        txInfo.transaction = tx
        wrapped(req, function () {
          assert.equal(tx.nameState.getPath(), '/foo/[param handler :bar]')
          end()
        })
      })
    })

    await t.test('should pop the namestate if there was no error', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      const wrapped = shim.recordParamware(function (_req, next) {
        setTimeout(function () {
          assert.equal(txInfo.transaction.nameState.getPath(), '/foo/[param handler :bar]')
          next()
        }, 10)
      }, new MiddlewareSpec({ name: 'bar', next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/foo')
        txInfo.transaction = tx
        wrapped(req, function () {
          assert.equal(tx.nameState.getPath(), '/foo')
          end()
        })
      })
    })
  })

  await t.test('#recordRender', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should not wrap non-function objects', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordRender(wrappable, new RenderSpec({ view: shim.FIRST }))
      assert.equal(wrapped, wrappable)
      assert.equal(shim.isWrapped(wrapped), false)
    })

    await t.test('should wrap the first parameter if no properties are given', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordRender(wrappable.bar, new RenderSpec({ view: shim.FIRST }))
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const { shim, wrappable } = t.nr
      const wrapped = shim.recordRender(wrappable.bar, null, new RenderSpec({ view: shim.FIRST }))
      assert.notEqual(wrapped, wrappable.bar)
      assert.equal(shim.isWrapped(wrapped), true)
      assert.equal(shim.unwrap(wrapped), wrappable.bar)
    })

    await t.test('should replace wrapped properties on the original object', function (t) {
      const { shim, wrappable } = t.nr
      const original = wrappable.bar
      shim.recordRender(wrappable, 'bar', new RenderSpec({ view: shim.FIRST }))
      assert.notEqual(wrappable.bar, original)
      assert.equal(shim.isWrapped(wrappable.bar), true)
      assert.equal(shim.unwrap(wrappable.bar), original)
    })

    await t.test('should not mark unwrapped properties as wrapped', function (t) {
      const { shim, wrappable } = t.nr
      shim.recordRender(wrappable, 'name', new RenderSpec({ view: shim.FIRST }))
      assert.equal(shim.isWrapped(wrappable.name), false)
    })

    await t.test('should call the wrapped function', function (t, end) {
      const { shim } = t.nr
      let called = false
      const wrapped = shim.recordRender(function () {
        called = true
      }, new RenderSpec({ view: shim.FIRST }))

      assert.equal(called, false)
      wrapped()
      assert.equal(called, true)
      end()
    })

    await t.test('should create a segment', function (t, end) {
      const { agent, shim, wrappable } = t.nr
      shim.recordRender(wrappable, 'getActiveSegment', new RenderSpec({ view: shim.FIRST }))
      helper.runInTransaction(agent, function () {
        const segment = wrappable.getActiveSegment('viewToRender')
        assert.equal(segment.name, 'View/viewToRender/Rendering')
        end()
      })
    })
  })

  await t.test('#savePossibleTransactionName', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should mark the path on the namestate', function (t, end) {
      const { agent, req, shim, txInfo } = t.nr
      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        const ns = tx.nameState
        ns.appendPath('asdf')
        shim.savePossibleTransactionName(req)
        ns.popPath()
        assert.equal(ns.getPath(), '/asdf')
        end()
      })
    })

    await t.test('should not explode when no req object is passed in', function (t) {
      const { shim } = t.nr
      assert.doesNotThrow(() => {
        shim.savePossibleTransactionName()
      })
    })
  })

  await t.test('#noticeError', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should cache errors in the transaction info', function (t) {
      const { req, shim, txInfo } = t.nr
      const err = new Error('test error')
      shim.noticeError(req, err)

      assert.equal(txInfo.error, err)
    })

    await t.test('should set handled to false', function (t) {
      const { req, shim, txInfo } = t.nr
      const err = new Error('test error')
      txInfo.errorHandled = true
      shim.noticeError(req, err)

      assert.equal(txInfo.errorHandled, false)
    })

    await t.test('should not change the error state for non-errors', function (t) {
      const { req, shim, txInfo } = t.nr
      shim.noticeError(req, null)
      assert.equal(txInfo.error, null)
      assert.ok(!txInfo.errorHandled)

      const err = new Error('test error')
      txInfo.error = err
      txInfo.errorHandled = true

      shim.noticeError(req, null)
      assert.equal(txInfo.error, err)
      assert.equal(txInfo.errorHandled, true)
    })
  })

  await t.test('#errorHandled', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should mark the error as handled', function (t) {
      const { req, shim, txInfo } = t.nr
      txInfo.error = new Error('err1')
      txInfo.errorHandled = false

      shim.errorHandled(req, txInfo.error)

      assert.equal(txInfo.errorHandled, true)
    })

    await t.test('should not mark as handled if the error is not the cached one', function (t) {
      const { req, shim, txInfo } = t.nr
      txInfo.error = new Error('err1')
      txInfo.errorHandled = false

      shim.errorHandled(req, new Error('err2'))

      assert.equal(txInfo.errorHandled, false)
    })
  })

  await t.test('#setErrorPredicate', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should set the function used to determine errors', function (t) {
      const { req, shim } = t.nr
      let called = false
      shim.setErrorPredicate(function () {
        called = true
        return true
      })

      assert.equal(called, false)
      shim.noticeError(req, new Error('test error'))
      assert.equal(called, true)
    })
  })
})
