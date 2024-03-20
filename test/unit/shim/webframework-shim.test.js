/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { test } = require('tap')

const sinon = require('sinon')
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')
const WebFrameworkShim = require('../../../lib/shim/webframework-shim')
const symbols = require('../../../lib/symbols')
const { MiddlewareSpec, RenderSpec } = require('../../../lib/shim/specs')

test.runOnly = true

test('WebFrameworkShim', function (t) {
  t.autoend()
  let agent = null
  let shim = null
  let wrappable = null
  let req = null
  let txInfo = null

  function beforeEach() {
    agent = helper.loadMockedAgent()
    shim = new WebFrameworkShim(agent, 'test-restify')
    shim.setFramework(WebFrameworkShim.RESTIFY)
    wrappable = {
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

    txInfo = {
      transaction: null,
      segmentStack: [],
      errorHandled: false,
      error: null
    }
    req = { [symbols.transactionInfo]: txInfo, params: { foo: 'bar', biz: 'bang' } }
  }

  function afterEach() {
    helper.unloadAgent(agent)
    agent = null
    shim = null
    req = null
    txInfo = null
  }

  t.test('constructor', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should inherit from Shim', function (t) {
      t.ok(shim instanceof WebFrameworkShim)
      t.ok(shim instanceof Shim)
      t.end()
    })
    t.test('should require the `agent` parameter', function (t) {
      t.throws(function () {
        return new WebFrameworkShim()
      }, /^Shim must be initialized with .*? agent/)
      t.end()
    })

    t.test('should require the `moduleName` parameter', function (t) {
      t.throws(function () {
        return new WebFrameworkShim(agent)
      }, /^Shim must be initialized with .*? module name/)
      t.end()
    })

    t.test('should assign properties from parent', (t) => {
      const mod = 'test-mod'
      const name = mod
      const version = '1.0.0'
      const shim = new WebFrameworkShim(agent, mod, mod, name, version)
      t.equal(shim.moduleName, mod)
      t.equal(agent, shim._agent)
      t.equal(shim.pkgVersion, version)
      t.end()
    })
  })

  t.test('enumerations', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should enumerate well-known frameworks on the class and prototype', function (t) {
      const frameworks = ['CONNECT', 'DIRECTOR', 'EXPRESS', 'HAPI', 'RESTIFY']
      frameworks.forEach(function (fw) {
        t.ok(WebFrameworkShim[fw])
        t.ok(shim[fw])
      })
      t.end()
    })

    t.test('should enumerate middleware types on the class and prototype', function (t) {
      const types = ['MIDDLEWARE', 'APPLICATION', 'ROUTER', 'ROUTE', 'ERRORWARE', 'PARAMWARE']
      types.forEach(function (type) {
        t.ok(WebFrameworkShim[type])
        t.ok(shim[type])
      })
      t.end()
    })
  })

  t.test('#logger', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should be a non-writable property', function (t) {
      t.throws(function () {
        shim.logger = 'foobar'
      })

      t.not(shim.logger, 'foobar')
      t.end()
    })

    t.test('should be a logger to use with the shim', function (t) {
      t.ok(shim.logger.trace instanceof Function)
      t.ok(shim.logger.debug instanceof Function)
      t.ok(shim.logger.info instanceof Function)
      t.ok(shim.logger.warn instanceof Function)
      t.ok(shim.logger.error instanceof Function)
      t.end()
    })
  })

  t.test('#setRouteParser', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should set the function used to parse routes', function (t) {
      let called = false
      shim.setRouteParser(function (shim, fn, fnName, route) {
        called = true
        t.equal(route, '/foo/bar')
        return route
      })

      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: shim.FIRST,
        wrapper: function (shim, middleware) {
          return middleware
        }
      })

      wrappable.bar('/foo/bar', function () {})
      t.ok(called)
      t.end()
    })
  })

  t.test('#setFramework', function (t) {
    t.autoend()

    t.beforeEach(function () {
      beforeEach()
      // Use a shim without a datastore set for these tests.
      shim = new WebFrameworkShim(agent, 'test-cassandra')
    })
    t.afterEach(afterEach)

    t.test('should accept the id of a well-known framework', function (t) {
      t.doesNotThrow(function () {
        shim.setFramework(shim.RESTIFY)
      })

      t.equal(shim._metrics.PREFIX, 'Restify/')
      t.end()
    })

    t.test('should create custom metric names if the `framework` is a string', function (t) {
      t.doesNotThrow(function () {
        shim.setFramework('Fake Web Framework')
      })

      t.equal(shim._metrics.PREFIX, 'Fake Web Framework/')
      t.end()
    })

    t.test("should update the shim's logger", function (t) {
      const original = shim.logger
      shim.setFramework(shim.RESTIFY)
      t.not(shim.logger, original)
      t.equal(shim.logger.extra.framework, 'Restify')
      t.end()
    })

    t.test('should set the Framework environment setting', function (t) {
      const env = agent.environment
      env.clearFramework()
      shim.setFramework(shim.RESTIFY)
      t.same(env.get('Framework'), ['Restify'])
      t.end()
    })
  })

  t.test('#wrapMiddlewareMounter', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.wrapMiddlewareMounter(wrappable, {})
      t.equal(wrapped, wrappable)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.wrapMiddlewareMounter(wrappable.bar, {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.wrapMiddlewareMounter(wrappable.bar, null, {})
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.wrapMiddlewareMounter(wrappable, 'bar', {})
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.wrapMiddlewareMounter(wrappable, 'name', {})
      t.notOk(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test('should call the middleware method for each function parameter', function (t) {
      let callCount = 0
      const args = [function a() {}, function b() {}, function c() {}]

      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        wrapper: function (shim, fn, name) {
          t.equal(fn, args[callCount])
          t.equal(name, args[callCount].name)
          ++callCount
        }
      })

      wrappable.bar.apply(wrappable, args)

      t.equal(callCount, args.length)
      t.end()
    })

    t.test('should call the original function with the wrapped middleware', function (t) {
      let originalCallCount = 0
      let wrapperCallCount = 0

      const wrapped = shim.wrapMiddlewareMounter(
        function (a, b, c) {
          ++originalCallCount
          t.equal(a, 1)
          t.equal(b, 2)
          t.equal(c, 3)
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
      t.equal(originalCallCount, 1)
      t.equal(wrapperCallCount, 3)
      t.end()
    })

    t.test('should pass the route to the middleware wrapper', function (t) {
      const realRoute = '/my/great/route'
      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: shim.FIRST,
        wrapper: function (shim, fn, name, route) {
          t.equal(route, realRoute)
        }
      })

      wrappable.bar(realRoute, function () {})
      t.end()
    })

    t.test('should pass an array of routes to the middleware wrapper', (t) => {
      const routes = ['/my/great/route', '/another/great/route']
      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: shim.FIRST,
        wrapper: (shim, fn, name, route) => {
          t.same(route, routes)
        }
      })

      wrappable.bar(routes, () => {})
      t.end()
    })

    t.test('should not overwrite regex entries in the array of routes', (t) => {
      const routes = [/a\/b\/$/, /anotherRegex/, /a/]
      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: shim.FIRST,
        wrapper: () => {
          routes.forEach((r) => {
            t.ok(r instanceof RegExp)
          })
        }
      })

      wrappable.bar(routes, () => {})
      t.end()
    })

    t.test('should pass null if the route parameter is a middleware', function (t) {
      let callCount = 0
      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: shim.FIRST,
        wrapper: function (shim, fn, name, route) {
          t.equal(route, null)
          ++callCount
        }
      })

      wrappable.bar(
        function () {},
        function () {}
      )
      t.equal(callCount, 2)
      t.end()
    })

    t.test('should pass null if the spec says there is no route', function (t) {
      let callCount = 0
      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: null,
        wrapper: function (shim, fn, name, route) {
          t.equal(route, null)
          ++callCount
        }
      })

      wrappable.bar(
        function () {},
        function () {}
      )
      t.equal(callCount, 2)
      t.end()
    })

    t.test('should iterate through the contents of the array', function (t) {
      let callCount = 0
      const funcs = [function a() {}, function b() {}, function c() {}]
      const args = [[funcs[0], funcs[1]], funcs[2]]

      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        wrapper: function (shim, fn, name) {
          t.equal(fn, funcs[callCount])
          t.equal(name, funcs[callCount].name)
          ++callCount
        }
      })

      wrappable.bar.apply(wrappable, args)

      t.equal(funcs.length, callCount)
      t.end()
    })

    t.test('should iterate through the contents of nested arrays too', function (t) {
      let callCount = 0
      const funcs = [function a() {}, function b() {}, function c() {}]
      const args = [[[[[funcs[0], [[funcs[1]]]]], funcs[2]]]]

      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        wrapper: function (shim, fn, name) {
          t.equal(fn, funcs[callCount])
          t.equal(name, funcs[callCount].name)
          ++callCount
        }
      })

      wrappable.bar.apply(wrappable, args)

      t.equal(funcs.length, callCount)
      t.end()
    })
  })

  t.test('#recordMiddleware', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.recordMiddleware(wrappable, new MiddlewareSpec({}))
      t.equal(wrapped, wrappable)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.recordMiddleware(wrappable.bar, new MiddlewareSpec({}))
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.recordMiddleware(wrappable.bar, null, new MiddlewareSpec({}))
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.recordMiddleware(wrappable, 'bar', new MiddlewareSpec({}))
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.recordMiddleware(wrappable, 'name', new MiddlewareSpec({}))
      t.notOk(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test('should call the wrapped function', function (t) {
      let called = false
      const wrapped = shim.recordMiddleware(function (_req, a, b, c) {
        called = true
        t.equal(_req, req)
        t.equal(a, 'a')
        t.equal(b, 'b')
        t.equal(c, 'c')
      }, new MiddlewareSpec({}))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        t.notOk(called)
        wrapped(req, 'a', 'b', 'c')
        t.ok(called)
        t.end()
      })
    })

    t.test('should not affect transaction name state if type is errorware', function (t) {
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

          t.notOk(tx.nameState.appendPath.called)
          t.notOk(tx.nameState.popPath.called)
          t.equal(segment.name, expectedName)
        })
      }
      t.end()
    })

    t.test('should name the segment according to the middleware type', function (t) {
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

          t.equal(segment.name, expectedName)
        })
      }
      t.end()
    })

    t.test('should not append a route if one is not given', function (t) {
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

          t.equal(segment.name, expectedName)
        })
      }
      t.end()
    })

    t.test('should not prepend root if the value is an array', function (t) {
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

          t.equal(segment.name, expectedName)
        })
      }
      t.end()
    })

    t.test('should reinstate its own context', function (t) {
      testType(shim.MIDDLEWARE, 'Nodejs/Middleware/Restify/getActiveSegment')

      function testType(type, expectedName) {
        const wrapped = shim.recordMiddleware(
          wrappable.getActiveSegment,
          new MiddlewareSpec({
            type: type,
            route: ''
          })
        )
        const tx = helper.runInTransaction(agent, function (_tx) {
          return _tx
        })
        txInfo.transaction = tx
        txInfo.segmentStack.push(tx.trace.root)

        const segment = wrapped(req)

        t.equal(segment.name, expectedName)
      }
      t.end()
    })

    t.test('should capture route parameters when high_security is off', function (t) {
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

        t.ok(segment.attributes)
        const attrs = segment.getAttributes()
        t.equal(attrs['request.parameters.route.foo'], 'bar')
        t.equal(attrs['request.parameters.route.biz'], 'bang')
        const filePathSplit = attrs['code.filepath'].split('/')
        t.equal(filePathSplit[filePathSplit.length - 1], 'webframework-shim.test.js')
        t.equal(attrs['code.function'], 'getActiveSegment')
        t.equal(attrs['code.lineno'], 40)
        t.equal(attrs['code.column'], 50)
        t.end()
      })
    })

    t.test('should not capture route parameters when high_security is on', function (t) {
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

        t.ok(segment.attributes)
        const attrs = Object.keys(segment.getAttributes())
        const requestParameters = /request\.parameters.*/

        t.notOk(attrs.some((attr) => requestParameters.test(attr)))
        t.end()
      })
    })

    t.test('should notice thrown exceptions', function (t) {
      const wrapped = shim.recordMiddleware(function () {
        throw new Error('foobar')
      }, new MiddlewareSpec({}))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        t.throws(() => {
          wrapped(req)
        }, 'foobar')

        t.match(txInfo.error, /foobar/)
        t.notOk(txInfo.errorHandled)
        t.end()
      })
    })

    t.test('pops the name if error was thrown and there is no next handler', function (t) {
      const wrapped = shim.recordMiddleware(function () {
        throw new Error('foobar')
      }, new MiddlewareSpec({ route: '/foo/bar' }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        t.throws(() => {
          wrapped(req)
        })

        t.equal(tx.nameState.getPath(), '/foo/bar')
        t.end()
      })
    })

    t.test('does not pop the name if there was an error and a next handler', function (t) {
      const wrapped = shim.recordMiddleware(function () {
        throw new Error('foobar')
      }, new MiddlewareSpec({ route: '/foo/bar', next: shim.SECOND }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        t.throws(() => {
          wrapped(req, function () {})
        })

        t.equal(tx.nameState.getPath(), '/foo/bar')
        t.end()
      })
    })

    t.test('should pop the namestate if there was no error', function (t) {
      const wrapped = shim.recordMiddleware(function () {},
      new MiddlewareSpec({ route: '/foo/bar' }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        wrapped(req)

        t.equal(tx.nameState.getPath(), '/')
        t.end()
      })
    })

    t.test('should pop the namestate if error is not an error', function (t) {
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
        t.equal(tx.nameState.getPath(), '/')

        wrapped(req, err, function () {}) // Error!
        t.equal(tx.nameState.getPath(), '/foo/bar')
        t.end()
      })
    })
    t.test('should notice errors handed to the callback', function (t) {
      const wrapped = shim.recordMiddleware(function (_req, next) {
        setTimeout(next, 10, new Error('foobar'))
      }, new MiddlewareSpec({ next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        wrapped(req, function (err) {
          t.ok(err instanceof Error)
          t.equal(err.message, 'foobar')

          t.equal(txInfo.error, err)
          t.notOk(txInfo.errorHandled)
          t.end()
        })
      })
    })

    t.test('should not pop the name if there was an error', function (t) {
      const wrapped = shim.recordMiddleware(function (_req, next) {
        setTimeout(next, 10, new Error('foobar'))
      }, new MiddlewareSpec({ route: '/foo/bar', next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        wrapped(req, function () {
          t.equal(tx.nameState.getPath(), '/foo/bar')
          t.end()
        })
      })
    })

    t.test('should pop the namestate if there was no error', function (t) {
      const wrapped = shim.recordMiddleware(function (_req, next) {
        setTimeout(function () {
          t.equal(txInfo.transaction.nameState.getPath(), '/foo/bar')
          next()
        }, 10)
      }, new MiddlewareSpec({ route: '/foo/bar', next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        wrapped(req, function () {
          t.equal(tx.nameState.getPath(), '/')
          t.end()
        })
      })
    })

    t.test('should not append path and should not pop path', function (t) {
      const spec = new MiddlewareSpec({
        route: '/foo/bar',
        appendPath: false,
        next: shim.LAST
      })

      const wrapped = shim.recordMiddleware(function (_req, next) {
        setTimeout(function () {
          // verify did not append the path
          t.equal(txInfo.transaction.nameState.getPath(), '/expected')
          next()
        }, 10)
      }, spec)

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        tx.nameState.appendPath('/expected')

        txInfo.transaction = tx
        wrapped(req, function () {
          // verify did not pop back to '/' from '/expected'
          t.equal(tx.nameState.getPath(), '/expected')
          t.end()
        })
      })
    })

    t.test('should mark the error as handled', function (t) {
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
          t.equal(txInfo.error, err)
          t.notOk(txInfo.errorHandled)

          errorware(err, req)
          t.equal(txInfo.error, err)
          t.ok(txInfo.errorHandled)
          t.end()
        }
      })
    })

    t.test('should notice if the errorware errors', function (t) {
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
          t.equal(txInfo.error, err)
          t.notOk(txInfo.errorHandled)

          try {
            errorware(err, req)
          } catch (err2) {
            t.equal(txInfo.error, err2)
            t.notOk(txInfo.errorHandled)
            t.end()
          }
        }
      })
    })
  })

  t.test('#recordMiddleware when middleware returns a promise', function (t) {
    t.autoend()
    let unwrappedTimeout = null
    let middleware = null
    let wrapped = null
    let segment = null

    t.beforeEach(function () {
      beforeEach()
      unwrappedTimeout = shim.unwrap(setTimeout)
      middleware = function (_req, err, next) {
        segment = shim.getSegment()
        return new Promise(function (resolve, reject) {
          unwrappedTimeout(function () {
            try {
              t.equal(txInfo.transaction.nameState.getPath(), '/foo/bar')
              if (next) {
                return next().then(
                  function () {
                    t.equal(txInfo.transaction.nameState.getPath(), '/foo/bar')
                    resolve()
                  },
                  function (err) {
                    t.equal(txInfo.transaction.nameState.getPath(), '/')

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

      wrapped = shim.recordMiddleware(
        middleware,
        new MiddlewareSpec({
          route: '/foo/bar',
          next: shim.LAST,
          promise: true
        })
      )
    })
    t.afterEach(afterEach)

    t.test('should notice errors from rejected promises', function (t) {
      return helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        return wrapped(req, new Error('foobar')).catch(function (err) {
          t.ok(err instanceof Error)
          t.equal(err.message, 'foobar')
          t.equal(txInfo.error, err)
          t.notOk(txInfo.errorHandled)

          t.ok(segment.timer.getDurationInMillis() > 18)
        })
      })
    })

    t.test('should not pop the name if there was an error', function (t) {
      return helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        return wrapped(req, new Error('foobar')).catch(function () {
          t.equal(tx.nameState.getPath(), '/foo/bar')
          t.ok(segment.timer.getDurationInMillis() > 18)
        })
      })
    })

    t.test('should pop the namestate if there was no error', function (t) {
      return helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        return wrapped(req).then(function () {
          t.equal(tx.nameState.getPath(), '/')
          t.ok(segment.timer.getDurationInMillis() > 18)
        })
      })
    })

    t.test('should pop the name of the handler off when next is called', function (t) {
      return helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        return wrapped(req, null, function next() {
          t.equal(tx.nameState.getPath(), '/')
          return new Promise(function (resolve) {
            t.equal(agent.tracer.getTransaction(), tx)
            resolve()
          })
        })
      })
    })

    t.test('should have the right name when the next handler errors', function (t) {
      return helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        return wrapped(req, null, function next() {
          t.equal(tx.nameState.getPath(), '/')
          return new Promise(function (resolve, reject) {
            t.equal(agent.tracer.getTransaction(), tx)
            reject()
          })
        })
      })
    })

    t.test('should appropriately parent child segments in promise', () => {
      return helper.runInTransaction(agent, (tx) => {
        tx.nameState.appendPath('/')
        txInfo.transaction = tx
        return wrapped(req, null, () => {
          return new Promise((resolve) => {
            const _tx = agent.tracer.getTransaction()
            t.equal(_tx, tx)
            t.equal(_tx.nameState.getPath(), '/')

            const childSegment = _tx.agent.tracer.createSegment('childSegment')
            t.equal(childSegment.parent.name, 'Nodejs/Middleware/Restify/middleware//foo/bar')

            resolve()
          })
        })
      })
    })
  })

  t.test('#recordMiddleware when middleware returns promise and spec.appendPath is false', (t) => {
    t.autoend()
    let unwrappedTimeout = null
    let middleware = null
    let wrapped = null

    t.beforeEach(() => {
      beforeEach()
      unwrappedTimeout = shim.unwrap(setTimeout)
      middleware = (_req, err, next) => {
        return new Promise((resolve, reject) => {
          unwrappedTimeout(() => {
            try {
              t.equal(txInfo.transaction.nameState.getPath(), '/')
              if (next) {
                return next().then(
                  () => {
                    t.equal(txInfo.transaction.nameState.getPath(), '/')
                    resolve()
                  },
                  (err) => {
                    t.equal(txInfo.transaction.nameState.getPath(), '/')

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
    })
    t.afterEach(afterEach)

    t.test('should not append path when spec.appendPath is false', () => {
      wrapped = shim.recordMiddleware(
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
          t.equal(tx.nameState.getPath(), '/')
          return new Promise((resolve) => {
            const _tx = agent.tracer.getTransaction()
            t.equal(_tx, tx)
            t.equal(_tx.nameState.getPath(), '/')
            resolve()
          })
        })
      })
    })
  })

  t.test('#recordParamware', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.recordParamware(wrappable, new MiddlewareSpec({}))
      t.equal(wrapped, wrappable)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.recordParamware(wrappable.bar, new MiddlewareSpec({}))
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.recordParamware(wrappable.bar, null, new MiddlewareSpec({}))
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.recordParamware(wrappable, 'bar', new MiddlewareSpec({}))
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.recordParamware(wrappable, 'name', new MiddlewareSpec({}))
      t.notOk(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test('should call the wrapped function', function (t) {
      let called = false
      const wrapped = shim.recordParamware(function (_req, a, b, c) {
        called = true
        t.equal(_req, req)
        t.equal(a, 'a')
        t.equal(b, 'b')
        t.equal(c, 'c')
      }, new MiddlewareSpec({}))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        t.notOk(called)
        wrapped(req, 'a', 'b', 'c')
        t.ok(called)
        t.end()
      })
    })

    t.test('should name the segment as a paramware', function (t) {
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

          t.equal(segment.name, expectedName)
        })
      }
      t.end()
    })

    t.test('should notice thrown exceptions', function (t) {
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
          t.ok(e instanceof Error)
          t.equal(e.message, 'foobar')
        }
        t.equal(txInfo.error, err)
        t.notOk(txInfo.errorHandled)
        t.end()
      })
    })

    t.test('should not pop the name if there was an error', function (t) {
      const wrapped = shim.recordParamware(function () {
        throw new Error('foobar')
      }, new MiddlewareSpec({ name: 'bar' }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/foo/')
        txInfo.transaction = tx
        t.throws(() => {
          wrapped(req)
        })

        t.equal(tx.nameState.getPath(), '/foo/[param handler :bar]')
        t.end()
      })
    })

    t.test('should pop the namestate if there was no error', function (t) {
      const wrapped = shim.recordParamware(function () {}, new MiddlewareSpec({ name: 'bar' }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/foo')
        txInfo.transaction = tx
        wrapped(req)

        t.equal(tx.nameState.getPath(), '/foo')
        t.end()
      })
    })

    t.test('should notice errors handed to the callback', function (t) {
      const wrapped = shim.recordParamware(function (_req, next) {
        setTimeout(next, 10, new Error('foobar'))
      }, new MiddlewareSpec({ next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        wrapped(req, function (err) {
          t.ok(err instanceof Error)
          t.equal(err.message, 'foobar')

          t.equal(txInfo.error, err)
          t.notOk(txInfo.errorHandled)
          t.end()
        })
      })
    })

    t.test('should not pop the name if there was an error', function (t) {
      const wrapped = shim.recordParamware(function (_req, next) {
        setTimeout(next, 10, new Error('foobar'))
      }, new MiddlewareSpec({ name: 'bar', next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/foo')
        txInfo.transaction = tx
        wrapped(req, function () {
          t.equal(tx.nameState.getPath(), '/foo/[param handler :bar]')
          t.end()
        })
      })
    })

    t.test('should pop the namestate if there was no error', function (t) {
      const wrapped = shim.recordParamware(function (_req, next) {
        setTimeout(function () {
          t.equal(txInfo.transaction.nameState.getPath(), '/foo/[param handler :bar]')
          next()
        }, 10)
      }, new MiddlewareSpec({ name: 'bar', next: shim.LAST }))

      helper.runInTransaction(agent, function (tx) {
        tx.nameState.appendPath('/foo')
        txInfo.transaction = tx
        wrapped(req, function () {
          t.equal(tx.nameState.getPath(), '/foo')
          t.end()
        })
      })
    })
  })

  t.test('#recordRender', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should not wrap non-function objects', function (t) {
      const wrapped = shim.recordRender(wrappable, new RenderSpec({ view: shim.FIRST }))
      t.equal(wrapped, wrappable)
      t.notOk(shim.isWrapped(wrapped))
      t.end()
    })

    t.test('should wrap the first parameter if no properties are given', function (t) {
      const wrapped = shim.recordRender(wrappable.bar, new RenderSpec({ view: shim.FIRST }))
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should wrap the first parameter if `null` is given for properties', function (t) {
      const wrapped = shim.recordRender(wrappable.bar, null, new RenderSpec({ view: shim.FIRST }))
      t.not(wrapped, wrappable.bar)
      t.ok(shim.isWrapped(wrapped))
      t.equal(shim.unwrap(wrapped), wrappable.bar)
      t.end()
    })

    t.test('should replace wrapped properties on the original object', function (t) {
      const original = wrappable.bar
      shim.recordRender(wrappable, 'bar', new RenderSpec({ view: shim.FIRST }))
      t.not(wrappable.bar, original)
      t.ok(shim.isWrapped(wrappable.bar))
      t.equal(shim.unwrap(wrappable.bar), original)
      t.end()
    })

    t.test('should not mark unwrapped properties as wrapped', function (t) {
      shim.recordRender(wrappable, 'name', new RenderSpec({ view: shim.FIRST }))
      t.notOk(shim.isWrapped(wrappable.name))
      t.end()
    })

    t.test('should call the wrapped function', function (t) {
      let called = false
      const wrapped = shim.recordRender(function () {
        called = true
      }, new RenderSpec({ view: shim.FIRST }))

      t.notOk(called)
      wrapped()
      t.ok(called)
      t.end()
    })

    t.test('should create a segment', function (t) {
      shim.recordRender(wrappable, 'getActiveSegment', new RenderSpec({ view: shim.FIRST }))
      helper.runInTransaction(agent, function () {
        const segment = wrappable.getActiveSegment('viewToRender')
        t.equal(segment.name, 'View/viewToRender/Rendering')
        t.end()
      })
    })
  })

  t.test('#savePossibleTransactionName', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should mark the path on the namestate', function (t) {
      helper.runInTransaction(agent, function (tx) {
        txInfo.transaction = tx
        const ns = tx.nameState
        ns.appendPath('asdf')
        shim.savePossibleTransactionName(req)
        ns.popPath()
        t.equal(ns.getPath(), '/asdf')
        t.end()
      })
    })

    t.test('should not explode when no req object is passed in', function (t) {
      t.doesNotThrow(() => {
        shim.savePossibleTransactionName()
      })
      t.end()
    })
  })

  t.test('#noticeError', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should cache errors in the transaction info', function (t) {
      const err = new Error('test error')
      shim.noticeError(req, err)

      t.equal(txInfo.error, err)
      t.end()
    })

    t.test('should set handled to false', function (t) {
      const err = new Error('test error')
      txInfo.errorHandled = true
      shim.noticeError(req, err)

      t.notOk(txInfo.errorHandled)
      t.end()
    })

    t.test('should not change the error state for non-errors', function (t) {
      shim.noticeError(req, null)
      t.equal(txInfo.error, null)
      t.notOk(txInfo.errorHandled)

      const err = new Error('test error')
      txInfo.error = err
      txInfo.errorHandled = true

      shim.noticeError(req, null)
      t.equal(txInfo.error, err)
      t.ok(txInfo.errorHandled)
      t.end()
    })
  })

  t.test('#errorHandled', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should mark the error as handled', function (t) {
      txInfo.error = new Error('err1')
      txInfo.errorHandled = false

      shim.errorHandled(req, txInfo.error)

      t.ok(txInfo.errorHandled)
      t.end()
    })

    t.test('should not mark as handled if the error is not the cached one', function (t) {
      txInfo.error = new Error('err1')
      txInfo.errorHandled = false

      shim.errorHandled(req, new Error('err2'))

      t.notOk(txInfo.errorHandled)
      t.end()
    })
  })

  t.test('#setErrorPredicate', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should set the function used to determine errors', function (t) {
      let called = false
      shim.setErrorPredicate(function () {
        called = true
        return true
      })

      t.notOk(called)
      shim.noticeError(req, new Error('test error'))
      t.ok(called)
      t.end()
    })
  })
})
