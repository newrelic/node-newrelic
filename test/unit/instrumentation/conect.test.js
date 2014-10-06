var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , helper = require('../../lib/agent_helper')
  

function nextulator(req, res, next) { return next(); }

describe("an instrumented Connect stack", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    // testing some stuff further down that needs to be non-strict
    'use strict'

    var agent
      , initialize
      

    before(function () {
      agent = helper.loadMockedAgent()
      initialize = require('../../../lib/instrumentation/connect')
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws()
    })

    it("when passed an empty module", function () {
      initialize(agent, {})
      expect(function () { initialize(agent, {}); }).not.throws()
    })
  })

  describe("for Connect 1 (stubbed)", function () {
    var agent
      , stub
      , app
      

    beforeEach(function () {
      agent = helper.instrumentMockedAgent()

      stub = {
        version : '1.0.1',
        HTTPServer : {prototype : {
          use : function (route, middleware) {
            if (this.stack && typeof middleware === 'function') {
              this.stack.push({route : route, handle : middleware})
            }
            else if (this.stack && typeof route === 'function') {
              this.stack.push({route : '', handle : route})
            }

            return this
          }
        }}
      }

      require('../../../lib/instrumentation/connect')(agent, stub)

      app = stub.HTTPServer.prototype
    })

    afterEach(function () {
      helper.unloadAgent(agent)
    })

    it("shouldn't throw if there's no middleware chain", function () {
      expect(function () { app.use.call(app, nextulator); }).not.throws()
    })

    it("shouldn't throw if there's a middleware link with no handler", function () {
      app.stack = []

      expect(function () { app.use.call(app, '/'); }).not.throws()
    })

    it("shouldn't throw if there's a middleware link with a non-function handler",
       function () {
      app.stack = []

      expect(function () { app.use.call(app, '/', 'hamburglar'); }).not.throws()
    })

    it("should add an error interceptor to an empty middleware chain", function () {
      app.stack = []

      app.use.call(app)

      expect(app.stack.length).equal(1)
      should.exist(app.stack[0].handle)
      expect(app.stack[0].handle.name).equal('sentinel')
    })

    it("should put the error interceptor at the end of the chain", function () {
      app.stack = []

      app.use.call(app, '/', nextulator)
      app.use.call(app, '/test', nextulator)
      app.use.call(app, '/help', nextulator)

      expect(app.stack.length).equal(4)
      should.exist(app.stack[3].handle)
      expect(app.stack[3].handle.name).equal('sentinel')
    })

    it("should put the error interceptor before the first error handler", function () {
      function errulator(err, req, res, next) {
        return next(err)
      }

      app.stack = []

      app.use.call(app, '/', nextulator)
      app.use.call(app, '/test', nextulator)
      app.use.call(app, '/error1', errulator)
      app.use.call(app, '/help', nextulator)
      app.use.call(app, '/error2', errulator)

      expect(app.stack.length).equal(6)
      should.exist(app.stack[2].handle)
      expect(app.stack[2].handle.name).equal('sentinel')
    })

    it("shouldn't barf on functions with ES5 future reserved keyword names", function () {
      // doin this on porpoise
      // jshint -W024
      function static(req, res, next) {
        return next()
      }

      app.stack = []

      expect(function () { app.use.call(app, '/', static); }).not.throws()
    })

    it("should mangle function names with a reserved keyword name", function () {
      // doin this on porpoise
      // jshint -W024
      function static(req, res, next) {
        return next()
      }

      app.stack = []

      app.use.call(app, '/', static)

      expect(app.stack[0].handle.name).equal('static_')
    })
  })

  describe("for Connect 2 (stubbed)", function () {
    var agent
      , stub
      , app
      

    beforeEach(function () {
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

      require('../../../lib/instrumentation/connect')(agent, stub)

      app = stub.proto
    })

    afterEach(function () {
      helper.unloadAgent(agent)
    })

    it("shouldn't throw if there's no middleware chain", function () {
      var app = stub.proto
      expect(function () { app.use.call(app, nextulator); }).not.throws()
    })

    it("shouldn't throw if there's a middleware link with no handler", function () {
      app.stack = []

      expect(function () { app.use.call(app, '/'); }).not.throws()
    })

    it("shouldn't throw if there's a middleware link with a non-function handler",
       function () {
      app.stack = []

      expect(function () { app.use.call(app, '/', 'hamburglar'); }).not.throws()
    })

    it("should add an error interceptor to an empty middleware chain", function () {
      app.stack = []

      app.use.call(app)
      expect(app.stack.length).equal(1)
      should.exist(app.stack[0].handle)
      expect(app.stack[0].handle.name).equal('sentinel')
    })

    it("should put the error interceptor at the end of the chain", function () {
      app.stack = []

      app.use.call(app, '/', nextulator)
      app.use.call(app, '/test', nextulator)
      app.use.call(app, '/help', nextulator)

      expect(app.stack.length).equal(4)
      should.exist(app.stack[3].handle)
      expect(app.stack[3].handle.name).equal('sentinel')
    })

    it("should put the error interceptor before the first error handler", function () {
      function errulator(err, req, res, next) {
        return next(err)
      }

      app.stack = []

      app.use.call(app, '/', nextulator)
      app.use.call(app, '/test', nextulator)
      app.use.call(app, '/error1', errulator)
      app.use.call(app, '/help', nextulator)
      app.use.call(app, '/error2', errulator)

      expect(app.stack.length).equal(6)
      should.exist(app.stack[2].handle)
      expect(app.stack[2].handle.name).equal('sentinel')
    })

    it("shouldn't barf on functions with ES5 future reserved keyword names", function () {
      // doin this on porpoise
      // jshint -W024
      function static(req, res, next) {
        return next()
      }

      app.stack = []

      expect(function () { app.use.call(app, '/', static); }).not.throws()
    })

    it("should mangle function names with a reserved keyword name", function () {
      // doin this on porpoise
      // jshint -W024
      function static(req, res, next) {
        return next()
      }

      app.stack = []

      app.use.call(app, '/', static)

      expect(app.stack[0].handle.name).equal('static_')
    })
  })
})
