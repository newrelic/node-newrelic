'use strict'

var sinon = require('sinon')
var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var Shim = require('../../../lib/shim/shim')
var WebFrameworkShim = require('../../../lib/shim/webframework-shim')


describe('WebFrameworkShim', function() {
  var agent = null
  var shim = null
  var wrappable = null
  var req = null
  var txInfo = null
  var Promise = null

  beforeEach(function() {
    agent = helper.loadMockedAgent()
    shim = new WebFrameworkShim(agent, 'test-restify', null, WebFrameworkShim.RESTIFY)
    wrappable = {
      name: 'this is a name',
      bar: function barsName(unused, params) { return 'bar' }, // eslint-disable-line
      fiz: function fizsName() { return 'fiz' },
      anony: function() {},
      middleware: function(_req, res, next) {
        return {req: _req, res: res, next: next, segment: agent.tracer.getSegment()}
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
    req = {__NR_transactionInfo: txInfo, params: {foo: 'bar', biz: 'bang'}}
    Promise = require('bluebird')
  })

  afterEach(function() {
    helper.unloadAgent(agent)
    agent = null
    shim = null
    req = null
    txInfo = null
    Promise = null
  })

  it('should inherit from Shim', function() {
    expect(shim)
      .to.be.an.instanceof(WebFrameworkShim)
      .and.an.instanceof(Shim)
  })

  describe('constructor', function() {
    it('should require the `agent` parameter', function() {
      expect(function() { return new WebFrameworkShim() })
        .to.throw(Error, /^Shim must be initialized with .*? agent/)
    })

    it('should require the `moduleName` parameter', function() {
      expect(function() { return new WebFrameworkShim(agent) })
        .to.throw(Error, /^Shim must be initialized with .*? module name/)
    })

    it('should take an optional `framework`', function() {
      // Test without datastore
      var _shim = null
      expect(function() {
        _shim = new WebFrameworkShim(agent, 'test-restify')
      }).to.not.throw()
      expect(_shim).to.not.have.property('_metrics')

      // Use one provided for all tests to check constructed with datastore
      expect(shim).to.have.property('_metrics')
    })
  })

  describe('enumerations', function() {
    it('should enumerate well-known frameworks on the class and prototype', function() {
      var frameworks = [
        'CONNECT',
        'DIRECTOR',
        'EXPRESS',
        'HAPI',
        'RESTIFY'
      ]
      frameworks.forEach(function(fw) {
        expect(WebFrameworkShim).to.have.property(fw)
        expect(shim).to.have.property(fw)
      })
    })

    it('should enumerate middleware types on the class and prototype', function() {
      var types = [
        'MIDDLEWARE',
        'APPLICATION',
        'ROUTER',
        'ROUTE',
        'ERRORWARE',
        'PARAMWARE'
      ]
      types.forEach(function(type) {
        expect(WebFrameworkShim).to.have.property(type)
        expect(shim).to.have.property(type)
      })
    })
  })

  describe('#logger', function() {
    it('should be a non-writable property', function() {
      expect(function() {
        shim.logger = 'foobar'
      }).to.throw()

      expect(shim)
        .to.have.property('logger')
        .that.is.not.equal('foobar')
    })

    it('should be a logger to use with the shim', function() {
      expect(shim.logger).to.have.property('trace')
        .that.is.an.instanceof(Function)
      expect(shim.logger).to.have.property('debug')
        .that.is.an.instanceof(Function)
      expect(shim.logger).to.have.property('info')
        .that.is.an.instanceof(Function)
      expect(shim.logger).to.have.property('warn')
        .that.is.an.instanceof(Function)
      expect(shim.logger).to.have.property('error')
        .that.is.an.instanceof(Function)
    })
  })

  describe('#setRouteParser', function() {
    it('should set the function used to parse routes', function() {
      var called = false
      shim.setRouteParser(function(shim, fn, fnName, route) {
        called = true
        expect(route).to.equal('/foo/bar')
        return route
      })

      shim.wrapMiddlewareMounter(wrappable, 'bar', {
        route: shim.FIRST,
        wrapper: function(shim, middleware) {
          return middleware
        }
      })

      wrappable.bar('/foo/bar', function() {})
      expect(called).to.be.true
    })
  })

  describe('#setFramework', function() {
    var shim = null

    beforeEach(function() {
      // Use a shim without a datastore set for these tests.
      shim = new WebFrameworkShim(agent, 'test-cassandra')
    })

    it('should accept the id of a well-known framework', function() {
      expect(function() {
        shim.setFramework(shim.RESTIFY)
      }).to.not.throw()

      expect(shim)
        .to.have.property('_metrics')
        .that.has.property('PREFIX', 'Restify/')
    })

    it('should create custom metric names if the `framework` is a string', function() {
      expect(function() {
        shim.setFramework('Fake Web Framework')
      }).to.not.throw()

      expect(shim)
        .to.have.property('_metrics')
        .that.has.property('PREFIX', 'Fake Web Framework/')
    })

    it('should update the shim\'s logger', function() {
      var original = shim.logger
      shim.setFramework(shim.RESTIFY)
      expect(shim.logger)
        .to.not.equal(original)
      expect(shim.logger)
        .to.have.property('extra')
        .that.has.property('framework', 'Restify')
    })

    it('should set the Framework environment setting', function() {
      var env = agent.environment
      env.clearFramework()
      shim.setFramework(shim.RESTIFY)
      expect(env.get('Framework')).to.deep.equal(['Restify'])
    })
  })

  describe('#wrapMiddlewareMounter', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.wrapMiddlewareMounter(wrappable, {})
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.wrapMiddlewareMounter(wrappable.bar, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.wrapMiddlewareMounter(wrappable.bar, null, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.wrapMiddlewareMounter(wrappable, 'bar', {})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.wrapMiddlewareMounter(wrappable, 'name', {})
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('wrapper', function() {
      it('should call the middleware method for each function parameter', function() {
        var callCount = 0
        var args = [function a() {}, function b() {}, function c() {}]

        shim.wrapMiddlewareMounter(wrappable, 'bar', {
          wrapper: function(shim, fn, name) {
            expect(fn).to.equal(args[callCount])
            expect(name).to.equal(args[callCount].name)
            ++callCount
          }
        })

        wrappable.bar.apply(wrappable, args)

        expect(callCount).to.equal(args.length)
      })

      it('should call the original function with the wrapped middleware', function() {
        var originalCallCount = 0
        var wrapperCallCount = 0

        var wrapped = shim.wrapMiddlewareMounter(function(a, b, c) {
          ++originalCallCount
          expect(a).to.equal(1)
          expect(b).to.equal(2)
          expect(c).to.equal(3)
        }, function() {
          return ++wrapperCallCount
        })

        wrapped(function() {}, function() {}, function() {})
        expect(originalCallCount).to.equal(1)
        expect(wrapperCallCount).to.equal(3)
      })

      describe('route extraction', function() {
        it('should pass the route to the middleware wrapper', function() {
          var realRoute = '/my/great/route'
          shim.wrapMiddlewareMounter(wrappable, 'bar', {
            route: shim.FIRST,
            wrapper: function(shim, fn, name, route) {
              expect(route).to.equal(realRoute)
            }
          })

          wrappable.bar(realRoute, function() {})
        })

        it('should pass an array of routes to the middleware wrapper', () => {
          const routes = ['/my/great/route', '/another/great/route']
          shim.wrapMiddlewareMounter(wrappable, 'bar', {
            route: shim.FIRST,
            wrapper: (shim, fn, name, route) => {
              expect(route).to.deep.equal(routes)
            }
          })

          wrappable.bar(routes, () => {})
        })

        it('should not overwrite regex entries in the array of routes', () => {
          const routes = [/a\/b\/$/, /anotherRegex/, /a/]
          shim.wrapMiddlewareMounter(wrappable, 'bar', {
            route: shim.FIRST,
            wrapper: () => {
              routes.forEach((r) => {
                expect(r instanceof RegExp).to.be.true
              })
            }
          })

          wrappable.bar(routes, () => {})
        })

        it('should pass null if the route parameter is a middleware', function() {
          var callCount = 0
          shim.wrapMiddlewareMounter(wrappable, 'bar', {
            route: shim.FIRST,
            wrapper: function(shim, fn, name, route) {
              expect(route).to.equal(null)
              ++callCount
            }
          })

          wrappable.bar(function() {}, function() {})
          expect(callCount).to.equal(2)
        })

        it('should pass null if the spec says there is no route', function() {
          var callCount = 0
          shim.wrapMiddlewareMounter(wrappable, 'bar', {
            route: null,
            wrapper: function(shim, fn, name, route) {
              expect(route).to.equal(null)
              ++callCount
            }
          })

          wrappable.bar(function() {}, function() {})
          expect(callCount).to.equal(2)
        })
      })

      describe('when a parameter is an array', function() {
        it('should iterate through the contents of the array', function() {
          var callCount = 0
          var funcs = [function a() {}, function b() {}, function c() {}]
          var args = [[funcs[0], funcs[1]], funcs[2]]

          shim.wrapMiddlewareMounter(wrappable, 'bar', {
            wrapper: function(shim, fn, name) {
              expect(fn).to.equal(funcs[callCount])
              expect(name).to.equal(funcs[callCount].name)
              ++callCount
            }
          })

          wrappable.bar.apply(wrappable, args)

          expect(callCount).to.equal(funcs.length)
        })

        it('should iterate through the contents of nested arrays too', function() {
          var callCount = 0
          var funcs = [function a() {}, function b() {}, function c() {}]
          var args = [[[[[funcs[0], [[funcs[1]]]]], funcs[2]]]]

          shim.wrapMiddlewareMounter(wrappable, 'bar', {
            wrapper: function(shim, fn, name) {
              expect(fn).to.equal(funcs[callCount])
              expect(name).to.equal(funcs[callCount].name)
              ++callCount
            }
          })

          wrappable.bar.apply(wrappable, args)

          expect(callCount).to.equal(funcs.length)
        })
      })
    })
  })

  describe('#recordMiddleware', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.recordMiddleware(wrappable)
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.recordMiddleware(wrappable.bar, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.recordMiddleware(wrappable.bar, null, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.recordMiddleware(wrappable, 'bar', {})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.recordMiddleware(wrappable, 'name', {})
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('wrapper', function() {
      it('should call the wrapped function', function() {
        var called = false
        var wrapped = shim.recordMiddleware(function(_req, a, b, c) {
          called = true
          expect(_req).to.equal(req)
          expect(a).to.equal('a')
          expect(b).to.equal('b')
          expect(c).to.equal('c')
        })

        helper.runInTransaction(agent, function(tx) {
          txInfo.transaction = tx
          expect(called).to.be.false
          wrapped(req, 'a', 'b', 'c')
          expect(called).to.be.true
        })
      })

      it('should not affect transaction name state if type is errorware', function() {
        testType(shim.ERRORWARE, 'Nodejs/Middleware/Restify/getActiveSegment//foo/bar')

        function testType(type, expectedName) {
          var wrapped = shim.recordMiddleware(
            wrappable.getActiveSegment,
            {type: type, route: '/foo/bar'}
          )
          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            sinon.spy(tx.nameState, 'appendPath')
            sinon.spy(tx.nameState, 'popPath')
            var segment = wrapped(req)

            expect(tx.nameState.appendPath.called).to.be.false
            expect(tx.nameState.popPath.called).to.be.false
            expect(segment).to.exist.and.have.property('name', expectedName)
          })
        }
      })

      it('should name the segment according to the middleware type', function() {
        testType(shim.MIDDLEWARE, 'Nodejs/Middleware/Restify/getActiveSegment//foo/bar')
        testType(shim.APPLICATION, 'Restify/Mounted App: /foo/bar')
        testType(shim.ROUTER, 'Restify/Router: /foo/bar')
        testType(shim.ROUTE, 'Restify/Route Path: /foo/bar')
        testType(shim.ERRORWARE, 'Nodejs/Middleware/Restify/getActiveSegment//foo/bar')
        testType(shim.PARAMWARE, 'Nodejs/Middleware/Restify/getActiveSegment//foo/bar')

        function testType(type, expectedName) {
          var wrapped = shim.recordMiddleware(
            wrappable.getActiveSegment,
            {type: type, route: '/foo/bar'}
          )
          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            var segment = wrapped(req)

            expect(segment).to.exist.and.have.property('name', expectedName)
          })
        }
      })

      it('should not append a route if one is not given', function() {
        testType(shim.MIDDLEWARE, 'Nodejs/Middleware/Restify/getActiveSegment')
        testType(shim.APPLICATION, 'Restify/Mounted App: /')
        testType(shim.ROUTER, 'Restify/Router: /')
        testType(shim.ROUTE, 'Restify/Route Path: /')
        testType(shim.ERRORWARE, 'Nodejs/Middleware/Restify/getActiveSegment')
        testType(shim.PARAMWARE, 'Nodejs/Middleware/Restify/getActiveSegment')

        function testType(type, expectedName) {
          var wrapped = shim.recordMiddleware(
            wrappable.getActiveSegment,
            {type: type, route: ''}
          )
          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            var segment = wrapped(req)

            expect(segment).to.exist.and.have.property('name', expectedName)
          })
        }
      })

      it('should not prepend root if the value is an array', function() {
        testType(shim.MIDDLEWARE, 'Nodejs/Middleware/Restify/getActiveSegment//one,/two')
        testType(shim.APPLICATION, 'Restify/Mounted App: /one,/two')
        testType(shim.ROUTER, 'Restify/Router: /one,/two')
        testType(shim.ROUTE, 'Restify/Route Path: /one,/two')
        testType(shim.ERRORWARE, 'Nodejs/Middleware/Restify/getActiveSegment//one,/two')
        testType(shim.PARAMWARE, 'Nodejs/Middleware/Restify/getActiveSegment//one,/two')

        function testType(type, expectedName) {
          var wrapped = shim.recordMiddleware(
            wrappable.getActiveSegment,
            {type: type, route: ['/one', '/two']}
          )
          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            var segment = wrapped(req)

            expect(segment).to.exist.and.have.property('name', expectedName)
          })
        }
      })

      it('should reinstate its own context', function() {
        testType(shim.MIDDLEWARE, 'Nodejs/Middleware/Restify/getActiveSegment')

        function testType(type, expectedName) {
          var wrapped = shim.recordMiddleware(
            wrappable.getActiveSegment,
            {type: type, route: ''}
          )
          var tx = helper.runInTransaction(agent, function(_tx) {
            return _tx
          })
          txInfo.transaction = tx
          txInfo.segmentStack.push(tx.trace.root)

          var segment = wrapped(req)

          expect(segment).to.exist.and.have.property('name', expectedName)
        }
      })

      describe('when high_security is off', function() {
        beforeEach(function() {
          agent.config.high_security = false
        })

        it('should capture route parameters', function() {
          var wrapped = shim.recordMiddleware(
            wrappable.getActiveSegment,
            {type: shim.MIDDLEWARE, route: ['/one', '/two']}
          )
          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            var segment = wrapped(req)

            expect(segment).to.exist.and.to.have.property('attributes')
            expect(segment.getAttributes()).to.deep.equal({
              foo: 'bar',
              biz: 'bang'
            })
          })
        })
      })


      describe('when high_security is on', function() {
        beforeEach(function() {
          agent.config.high_security = true
        })

        it('should not capture route parameters', function() {
          var wrapped = shim.recordMiddleware(
            wrappable.getActiveSegment,
            {type: shim.MIDDLEWARE, route: ['/one', '/two']}
          )
          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            var segment = wrapped(req)

            expect(segment).to.exist.and.to.have.property('attributes')
            expect(segment.getAttributes()).to.deep.equal({})
          })
        })
      })

      describe('when the middleware is synchronous', function() {
        it('should notice thrown exceptions', function() {
          var wrapped = shim.recordMiddleware(function() {
            throw new Error('foobar')
          })

          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            var err = null
            try {
              wrapped(req)
            } catch (e) {
              err = e
              expect(e)
                .to.be.an.instanceOf(Error)
                .and.have.property('message', 'foobar')
            }
            expect(txInfo).to.have.property('error', err)
            expect(txInfo).to.have.property('errorHandled', false)
          })
        })

        it('pops the name if error was thrown and there is no next handler', function() {
          var wrapped = shim.recordMiddleware(function() {
            throw new Error('foobar')
          }, {route: '/foo/bar'})

          helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/')
            txInfo.transaction = tx
            try {
              wrapped(req)
            } catch (e) {
              // Don't care about the error...
            }

            expect(tx.nameState.getPath()).to.equal('/foo/bar')
          })
        })

        it('does not pop the name if there was an error and a next handler', function() {
          var wrapped = shim.recordMiddleware(function() {
            throw new Error('foobar')
          }, {route: '/foo/bar', next: shim.SECOND})

          helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/')
            txInfo.transaction = tx
            try {
              wrapped(req, function() {})
            } catch (e) {
              // Don't care about the error...
            }

            expect(tx.nameState.getPath()).to.equal('/foo/bar')
          })
        })

        it('should pop the namestate if there was no error', function() {
          var wrapped = shim.recordMiddleware(function() {}, {route: '/foo/bar'})

          helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/')
            txInfo.transaction = tx
            wrapped(req)

            expect(tx.nameState.getPath()).to.equal('/')
          })
        })

        it('should pop the namestate if error is not an error', function() {
          var wrapped = shim.recordMiddleware(function(r, obj, next) {
            next(obj)
          }, {route: '/foo/bar'})

          var err = new Error()
          shim.setErrorPredicate(function(obj) { return obj === err })

          helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/')
            txInfo.transaction = tx

            wrapped(req, {}, function() {}) // Not an error!
            expect(tx.nameState.getPath()).to.equal('/')

            wrapped(req, err, function() {}) // Error!
            expect(tx.nameState.getPath()).to.equal('/foo/bar')
          })
        })
      })

      describe('when the middleware is asynchronous', function() {
        it('should notice errors handed to the callback', function(done) {
          var wrapped = shim.recordMiddleware(function(_req, next) {
            setTimeout(next, 10, new Error('foobar'))
          }, {next: shim.LAST})

          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            wrapped(req, function(err) {
              expect(err)
                .to.be.an.instanceOf(Error)
                .and.have.property('message', 'foobar')

              expect(txInfo).to.have.property('error', err)
              expect(txInfo).to.have.property('errorHandled', false)
              done()
            })
          })
        })

        it('should not pop the name if there was an error', function(done) {
          var wrapped = shim.recordMiddleware(function(_req, next) {
            setTimeout(next, 10, new Error('foobar'))
          }, {route: '/foo/bar', next: shim.LAST})

          helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/')
            txInfo.transaction = tx
            wrapped(req, function() {
              expect(tx.nameState.getPath()).to.equal('/foo/bar')
              done()
            })
          })
        })

        it('should pop the namestate if there was no error', function(done) {
          var wrapped = shim.recordMiddleware(function(_req, next) {
            setTimeout(function() {
              expect(txInfo.transaction.nameState.getPath()).to.equal('/foo/bar')
              next()
            }, 10)
          }, {route: '/foo/bar', next: shim.LAST})

          helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/')
            txInfo.transaction = tx
            wrapped(req, function() {
              expect(tx.nameState.getPath()).to.equal('/')
              done()
            })
          })
        })
      })

      describe('when the middleware is asynchronous and spec.appendPath false', () => {
        it('should not append path and should not pop path', function(done) {
          const spec = {
            route: '/foo/bar',
            appendPath: false,
            next: shim.LAST
          }

          const wrapped = shim.recordMiddleware(function(_req, next) {
            setTimeout(function() {
              // verify did not append the path
              expect(txInfo.transaction.nameState.getPath()).to.equal('/expected')
              next()
            }, 10)
          }, spec)

          helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/')
            tx.nameState.appendPath('/expected')

            txInfo.transaction = tx
            wrapped(req, function() {
              // verify did not pop back to '/' from '/expected'
              expect(tx.nameState.getPath()).to.equal('/expected')
              done()
            })
          })
        })
      })

      describe('when middleware returns a promise', function() {
        var unwrappedTimeout = null
        var middleware = null
        var wrapped = null
        var segment = null

        beforeEach(function() {
          unwrappedTimeout = shim.unwrap(setTimeout)
          middleware = function(_req, err, next) {
            segment = shim.getSegment()
            return new Promise(function(resolve, reject) {
              unwrappedTimeout(function() {
                try {
                  expect(txInfo.transaction.nameState.getPath()).to.equal('/foo/bar')
                  if (next) {
                    return next().then(function() {
                      expect(txInfo.transaction.nameState.getPath()).to.equal('/foo/bar')
                      resolve()
                    }, function(err) {
                      expect(txInfo.transaction.nameState.getPath()).to.equal('/')

                      if (err && err.name === 'AssertionError') {
                        // Reject assertion errors from promises to fail the test
                        reject(err)
                      } else {
                        // Resolve for errors purposely triggered for tests.
                        resolve()
                      }
                    })
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

          wrapped = shim.recordMiddleware(middleware, {
            route: '/foo/bar',
            next: shim.LAST,
            promise: true
          })
        })

        it('should notice errors from rejected promises', function() {
          return helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            return wrapped(req, new Error('foobar')).catch(function(err) {
              expect(err)
                .to.be.an.instanceOf(Error)
                .and.have.property('message', 'foobar')

              expect(txInfo).to.have.property('error', err)
              expect(txInfo).to.have.property('errorHandled', false)

              expect(segment.timer.getDurationInMillis()).to.be.above(18)
            })
          })
        })

        it('should not pop the name if there was an error', function() {
          return helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/')
            txInfo.transaction = tx
            return wrapped(req, new Error('foobar')).catch(function() {
              expect(tx.nameState.getPath()).to.equal('/foo/bar')
              expect(segment.timer.getDurationInMillis()).to.be.above(18)
            })
          })
        })

        it('should pop the namestate if there was no error', function() {
          return helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/')
            txInfo.transaction = tx
            return wrapped(req).then(function() {
              expect(tx.nameState.getPath()).to.equal('/')
              expect(segment.timer.getDurationInMillis()).to.be.above(18)
            })
          })
        })

        it('should pop the name of the handler off when next is called', function() {
          return helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/')
            txInfo.transaction = tx
            return wrapped(req, null, function next() {
              expect(tx.nameState.getPath()).to.equal('/')
              return new Promise(function(resolve) {
                expect(agent.tracer.getTransaction()).to.equal(tx)
                resolve()
              })
            })
          })
        })

        it('should have the right name when the next handler errors', function() {
          return helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/')
            txInfo.transaction = tx
            return wrapped(req, null, function next() {
              expect(tx.nameState.getPath()).to.equal('/')
              return new Promise(function(resolve, reject) {
                expect(agent.tracer.getTransaction()).to.equal(tx)
                reject()
              })
            })
          })
        })

        it('should appropriately parent child segments in promise', () => {
          return helper.runInTransaction(agent, (tx) => {
            tx.nameState.appendPath('/')
            txInfo.transaction = tx
            return wrapped(req, null, () => {
              return new Promise((resolve) => {
                const _tx = agent.tracer.getTransaction()
                expect(_tx).to.equal(tx)
                expect(_tx.nameState.getPath()).to.equal('/')

                const childSegment = _tx.agent.tracer.createSegment('childSegment')
                expect(childSegment.parent.name)
                  .to.equal('Nodejs/Middleware/Restify/middleware//foo/bar')

                resolve()
              })
            })
          })
        })
      })

      describe(
        'when middleware returns promise and spec.appendPath is false',
        () => {
          let unwrappedTimeout = null
          let middleware = null
          let wrapped = null

          beforeEach(() => {
            unwrappedTimeout = shim.unwrap(setTimeout)
            middleware = (_req, err, next) => {
              return new Promise((resolve, reject) => {
                unwrappedTimeout(() => {
                  try {
                    expect(txInfo.transaction.nameState.getPath()).to.equal('/')
                    if (next) {
                      return next().then(() => {
                        expect(txInfo.transaction.nameState.getPath())
                          .to.equal('/')
                        resolve()
                      }, (err) => {
                        expect(txInfo.transaction.nameState.getPath()).to.equal('/')

                        if (err && err.name === 'AssertionError') {
                          // Reject assertion errors from promises to fail the test
                          reject(err)
                        } else {
                          // Resolve for errors purposely triggered for tests.
                          resolve()
                        }
                      })
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

            wrapped = shim.recordMiddleware(middleware, {
              route: '/foo/bar',
              appendPath: false,
              next: shim.LAST,
              promise: true
            })
          })

          it('should not append path', () => {
            return helper.runInTransaction(agent, (tx) => {
              tx.nameState.appendPath('/')
              txInfo.transaction = tx
              return wrapped(req, null, () => {
                expect(tx.nameState.getPath()).to.equal('/')
                return new Promise((resolve) => {
                  const _tx = agent.tracer.getTransaction()
                  expect(_tx).to.equal(tx)
                  expect(_tx.nameState.getPath()).to.equal('/')
                  resolve()
                })
              })
            })
          })
        }
      )


      describe('when wrapping errorware', function() {
        it('should mark the error as handled', function() {
          var wrapped = shim.recordMiddleware(function() {
            throw new Error('foobar')
          })

          var errorware = shim.recordMiddleware(
            function() {},
            {type: shim.ERRORWARE, req: shim.SECOND}
          )

          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            try {
              wrapped(req)
            } catch (err) {
              expect(txInfo).to.have.property('error', err)
              expect(txInfo).to.have.property('errorHandled').that.is.not.ok

              errorware(err, req)
              expect(txInfo).to.have.property('error', err)
              expect(txInfo).to.have.property('errorHandled').that.is.ok
            }
          })
        })

        it('should notice if the errorware errors', function() {
          var wrapped = shim.recordMiddleware(function() {
            throw new Error('foobar')
          })

          var errorware = shim.recordMiddleware(function() {
            throw new Error('errorware error')
          }, {type: shim.ERRORWARE, req: shim.SECOND})

          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            try {
              wrapped(req)
            } catch (err) {
              expect(txInfo).to.have.property('error', err)
              expect(txInfo).to.have.property('errorHandled', false)

              try {
                errorware(err, req)
              } catch (err2) {
                expect(txInfo).to.have.property('error', err2)
                expect(txInfo).to.have.property('errorHandled', false)
              }
            }
          })
        })
      })
    })
  })

  describe('#recordParamware', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.recordParamware(wrappable)
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.recordParamware(wrappable.bar, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.recordParamware(wrappable.bar, null, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.recordParamware(wrappable, 'bar', {})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.recordParamware(wrappable, 'name', {})
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('wrapper', function() {
      it('should call the wrapped function', function() {
        var called = false
        var wrapped = shim.recordParamware(function(_req, a, b, c) {
          called = true
          expect(_req).to.equal(req)
          expect(a).to.equal('a')
          expect(b).to.equal('b')
          expect(c).to.equal('c')
        })

        helper.runInTransaction(agent, function(tx) {
          txInfo.transaction = tx
          expect(called).to.be.false
          wrapped(req, 'a', 'b', 'c')
          expect(called).to.be.true
        })
      })

      it('should name the segment as a paramware', function() {
        testType(
          shim.PARAMWARE,
          'Nodejs/Middleware/Restify/getActiveSegment//[param handler :foo]'
        )

        function testType(type, expectedName) {
          var wrapped = shim.recordParamware(
            wrappable.getActiveSegment,
            {type: type, name: 'foo'}
          )
          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            var segment = wrapped(req)

            expect(segment).to.exist.and.have.property('name', expectedName)
          })
        }
      })

      describe('when the paramware is synchronous', function() {
        it('should notice thrown exceptions', function() {
          var wrapped = shim.recordParamware(function() {
            throw new Error('foobar')
          })

          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            var err = null
            try {
              wrapped(req)
            } catch (e) {
              err = e
              expect(e)
                .to.be.an.instanceOf(Error)
                .and.have.property('message', 'foobar')
            }
            expect(txInfo).to.have.property('error', err)
            expect(txInfo).to.have.property('errorHandled', false)
          })
        })

        it('should not pop the name if there was an error', function() {
          var wrapped = shim.recordParamware(function() {
            throw new Error('foobar')
          }, {name: 'bar'})

          helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/foo/')
            txInfo.transaction = tx
            try {
              wrapped(req)
            } catch (e) {
              // Don't care about the error...
            }

            expect(tx.nameState.getPath()).to.equal('/foo/[param handler :bar]')
          })
        })

        it('should pop the namestate if there was no error', function() {
          var wrapped = shim.recordParamware(function() {}, {name: 'bar'})

          helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/foo')
            txInfo.transaction = tx
            wrapped(req)

            expect(tx.nameState.getPath()).to.equal('/foo')
          })
        })
      })

      describe('when the paramware is asynchronous', function() {
        it('should notice errors handed to the callback', function(done) {
          var wrapped = shim.recordParamware(function(_req, next) {
            setTimeout(next, 10, new Error('foobar'))
          }, {next: shim.LAST})

          helper.runInTransaction(agent, function(tx) {
            txInfo.transaction = tx
            wrapped(req, function(err) {
              expect(err)
                .to.be.an.instanceOf(Error)
                .and.have.property('message', 'foobar')

              expect(txInfo).to.have.property('error', err)
              expect(txInfo).to.have.property('errorHandled', false)
              done()
            })
          })
        })

        it('should not pop the name if there was an error', function(done) {
          var wrapped = shim.recordParamware(function(_req, next) {
            setTimeout(next, 10, new Error('foobar'))
          }, {name: 'bar', next: shim.LAST})

          helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/foo')
            txInfo.transaction = tx
            wrapped(req, function() {
              expect(tx.nameState.getPath()).to.equal('/foo/[param handler :bar]')
              done()
            })
          })
        })

        it('should pop the namestate if there was no error', function(done) {
          var wrapped = shim.recordParamware(function(_req, next) {
            setTimeout(function() {
              expect(txInfo.transaction.nameState.getPath())
                .to.equal('/foo/[param handler :bar]')
              next()
            }, 10)
          }, {name: 'bar', next: shim.LAST})

          helper.runInTransaction(agent, function(tx) {
            tx.nameState.appendPath('/foo')
            txInfo.transaction = tx
            wrapped(req, function() {
              expect(tx.nameState.getPath()).to.equal('/foo')
              done()
            })
          })
        })
      })
    })
  })

  describe('#recordRender', function() {
    it('should not wrap non-function objects', function() {
      var wrapped = shim.recordRender(wrappable)
      expect(wrapped).to.equal(wrappable)
      expect(shim.isWrapped(wrapped)).to.be.false
    })

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given', function() {
        var wrapped = shim.recordRender(wrappable.bar, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })

      it('should wrap the first parameter if `null` is given for properties', function() {
        var wrapped = shim.recordRender(wrappable.bar, null, {})
        expect(wrapped).to.not.equal(wrappable.bar)
        expect(shim.isWrapped(wrapped)).to.be.true
        expect(shim.unwrap(wrapped)).to.equal(wrappable.bar)
      })
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object', function() {
        var original = wrappable.bar
        shim.recordRender(wrappable, 'bar', {})
        expect(wrappable.bar).to.not.equal(original)
        expect(shim.isWrapped(wrappable.bar)).to.be.true
        expect(shim.unwrap(wrappable.bar)).to.equal(original)
      })

      it('should not mark unwrapped properties as wrapped', function() {
        shim.recordRender(wrappable, 'name', {})
        expect(shim.isWrapped(wrappable.name)).to.be.false
      })
    })

    describe('wrapper', function() {
      it('should call the wrapped function', function() {
        var called = false
        var wrapped = shim.recordRender(function() {
          called = true
        })

        wrapped()
        expect(called).to.be.true
      })

      it('should create a segment', function() {
        shim.recordRender(wrappable, 'getActiveSegment')
        helper.runInTransaction(agent, function() {
          var segment = wrappable.getActiveSegment('viewToRender')
          expect(segment)
            .to.exist
            .and.have.property('name', 'View/viewToRender/Rendering')
        })
      })
    })
  })

  describe('#savePossibleTransactionName', function() {
    it('should mark the path on the namestate', function() {
      helper.runInTransaction(agent, function(tx) {
        txInfo.transaction = tx
        var ns = tx.nameState
        ns.appendPath('asdf')
        shim.savePossibleTransactionName(req)
        ns.popPath()
        expect(ns.getPath()).to.equal('/asdf')
      })
    })

    it('should not explode when no req object is passed in', function() {
      shim.savePossibleTransactionName()
    })
  })

  describe('#noticeError', function() {
    it('should cache errors in the transaction info', function() {
      var err = new Error('test error')
      shim.noticeError(req, err)

      expect(txInfo.error).to.equal(err)
    })

    it('should set handled to false', function() {
      var err = new Error('test error')
      txInfo.errorHandled = true
      shim.noticeError(req, err)

      expect(txInfo.errorHandled).to.be.false
    })

    it('should not change the error state for non-errors', function() {
      shim.noticeError(req, null)
      expect(txInfo.error).to.equal(null)
      expect(txInfo.errorHandled).to.be.false

      var err = new Error('test error')
      txInfo.error = err
      txInfo.errorHandled = true

      shim.noticeError(req, null)
      expect(txInfo.error).to.equal(err)
      expect(txInfo.errorHandled).to.be.true
    })
  })

  describe('#errorHandled', function() {
    it('should mark the error as handled', function() {
      txInfo.error = new Error('err1')
      txInfo.errorHandled = false

      shim.errorHandled(req, txInfo.error)

      expect(txInfo.errorHandled).to.be.true
    })

    it('should not mark as handled if the error is not the cached one', function() {
      txInfo.error = new Error('err1')
      txInfo.errorHandled = false

      shim.errorHandled(req, new Error('err2'))

      expect(txInfo.errorHandled).to.be.false
    })
  })

  describe('#setErrorPredicate', function() {
    it('should set the function used to determine errors', function() {
      var called = false
      shim.setErrorPredicate(function() {
        called = true
        return true
      })

      shim.noticeError(req, new Error('test error'))

      expect(called).to.be.true
    })
  })

  describe('#captureUrlParams', function() {
    beforeEach(function() {
      agent.config.attributes.enabled = true
    })

    it('should copy the provided params onto the segment parameters', function() {
      var segment = {parameters: {foo: 'other', bang: 'bam'}}
      shim.getSegment = function() { return segment }
      shim.captureUrlParams({foo: 'bar', biz: 'baz'})
      expect(segment).property('parameters').to.deep.equal({
        foo: 'other',
        biz: 'baz',
        bang: 'bam'
      })
    })

    it('should not obey the attributes.enabled configuration', function() {
      agent.config.attributes.enabled = false
      var segment = {parameters: {foo: 'other', bang: 'bam'}}
      shim.getSegment = function() { return segment }
      shim.captureUrlParams({foo: 'bar', biz: 'baz'})
      expect(segment).property('parameters')
        .to.deep.equal({foo: 'other', biz: 'baz', bang: 'bam'})
    })

    it('should obey high_security mode', function() {
      agent.config.high_security = true
      var segment = {parameters: {foo: 'other'}}
      shim.getSegment = function() { return segment }
      shim.captureUrlParams({foo: 'bar', biz: 'baz'})
      expect(segment).property('parameters').to.deep.equal({foo: 'other'})
    })

    it('should not throw when out of a transaction', function() {
      shim.getSegment = function() { return null }
      expect(function() {
        shim.captureUrlParams({foo: 'bar'})
      }).to.not.throw()
    })
  })
})
