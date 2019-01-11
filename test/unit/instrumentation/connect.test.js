/* eslint-disable strict */

const chai = require('chai')
const expect = chai.expect
const helper = require('../../lib/agent_helper')
const WebShim = require('../../../lib/shim/webframework-shim')


function nextulator(req, res, next) { return next() }

describe("an instrumented Connect stack", function() {
  describe("shouldn't cause bootstrapping to fail", function() {
    // testing some stuff further down that needs to be non-strict
    'use strict'

    var agent
    var initialize
    var shim


    before(function() {
      agent = helper.loadMockedAgent()
      shim = new WebShim(agent, 'connect')
      initialize = require('../../../lib/instrumentation/connect')
    })

    after(function() {
      helper.unloadAgent(agent)
    })

    it("when passed no module", function() {
      expect(function() { initialize(agent, null, 'connect', shim) }).not.throws()
    })

    it("when passed an empty module", function() {
      expect(function() { initialize(agent, {}, 'connect', shim) }).not.throws()
    })
  })

  describe("for Connect 1 (stubbed)", function() {
    var agent
    var stub
    var app
    var shim


    beforeEach(function() {
      agent = helper.instrumentMockedAgent()

      stub = {
        version : '1.0.1',
        HTTPServer : {prototype : {
          use : function(route, middleware) {
            if (this.stack && typeof middleware === 'function') {
              this.stack.push({route: route, handle: middleware})
            } else if (this.stack && typeof route === 'function') {
              this.stack.push({route: '', handle: route})
            }

            return this
          }
        }}
      }

      shim = new WebShim(agent, 'connect')
      require('../../../lib/instrumentation/connect')(agent, stub, 'connect', shim)

      app = stub.HTTPServer.prototype
    })

    afterEach(function() {
      helper.unloadAgent(agent)
    })

    it("shouldn't throw if there's no middleware chain", function() {
      expect(function() { app.use.call(app, nextulator) }).not.throws()
    })

    it("shouldn't throw if there's a middleware link with no handler", function() {
      app.stack = []

      expect(function() { app.use.call(app, '/') }).not.throws()
    })

    it("shouldn't throw if there's a middleware link with a non-function handler", () => {
      app.stack = []

      expect(function() { app.use.call(app, '/', 'hamburglar') }).not.throws()
    })

    it("shouldn't break use", function() {
      function errulator(err, req, res, next) {
        return next(err)
      }

      app.stack = []

      app.use.call(app, '/', nextulator)
      app.use.call(app, '/test', nextulator)
      app.use.call(app, '/error1', errulator)
      app.use.call(app, '/help', nextulator)
      app.use.call(app, '/error2', errulator)

      expect(app.stack.length).equal(5)
    })

    it("shouldn't barf on functions with ES5 future reserved keyword names", function() {
      // doin this on porpoise
      // jshint -W024
      /* eslint-disable */
      function static(req, res, next) {
        return next()
      }

      app.stack = []

      expect(function () { app.use.call(app, '/', static); }).not.throws()
    })
  })

  describe("for Connect 2 (stubbed)", function () {
    var agent
    var stub
    var app
    var shim


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

      shim = new WebShim(agent, 'connect')
      require('../../../lib/instrumentation/connect')(agent, stub, 'connect', shim)

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

    it("shouldn't break use", function () {
      function errulator(err, req, res, next) {
        return next(err)
      }

      app.stack = []

      app.use.call(app, '/', nextulator)
      app.use.call(app, '/test', nextulator)
      app.use.call(app, '/error1', errulator)
      app.use.call(app, '/help', nextulator)
      app.use.call(app, '/error2', errulator)

      expect(app.stack.length).equal(5)
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
  })
})
