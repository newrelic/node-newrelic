'use strict'

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , helper = require('../../lib/agent_helper')


describe("an instrumented Express application", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize


    before(function () {
      agent = helper.loadMockedAgent()
      initialize = require('../../../lib/instrumentation/express')
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

  describe("for Express 2 (stubbed)", function () {
    var agent
      , stub
      , http


    before(function () {
      agent = helper.instrumentMockedAgent()
      agent.environment.clearDispatcher()
      agent.environment.clearFramework()

      function Router() {}
      Router.prototype._match = function _match() { return {path : '/test/:id'}; }

      stub = {
        version : '2.5.3',
        createServer : function () {
          return {
            routes : new Router()
          }
        }
      }

      http = require('http')
      should.not.exist(http.ServerResponse.prototype.render)
      http.ServerResponse.prototype.render = function render(view, options, cb) {
        process.nextTick(cb)
        return 'rendered'
      }
      http.ServerResponse.prototype.send = function send() {}

      require('../../../lib/instrumentation/express')(agent, stub)
    })

    after(function () {
      helper.unloadAgent(agent)
      delete http.ServerResponse.prototype.render
      delete http.ServerResponse.prototype.send
    })

    it("should set dispatcher to Express when a new server is created", function () {
      should.exist(stub.createServer().routes.constructor.prototype._match)

      var dispatchers = agent.environment.get('Dispatcher')
      expect(dispatchers.length).equal(1)
      expect(dispatchers[0]).equal('express')
    })

    it("should set framework to Express when a new server is created", function () {
      should.exist(stub.createServer().routes.constructor.prototype._match)

      var frameworks = agent.environment.get('Framework')
      expect(frameworks.length).equal(1)
      expect(frameworks[0]).equal('express')
    })

    it("should trace http.ServerResponse.prototype.render", function (done) {
      should.exist(http.ServerResponse.prototype.render)
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()
          // FIXME: too quick, too dirty
          , res         = http.ServerResponse.prototype


        function finalizer() {
          var json     = transaction.trace.root.toJSON()
            , children = json[4]
            , render   = children[0]
            , name     = render[2]


          expect(name).equal('View/TEST/Rendering')
          transaction.end()

          return done()
        }

        function handler() {
          process.nextTick(finalizer)
        }

        expect(res.render.call(res, 'TEST', {}, handler)).equal('rendered')
      })
    })

    it("should trace http.ServerResponse.prototype.render when called with no options",
       function (done) {
      should.exist(http.ServerResponse.prototype.render)
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()

        var res = http.ServerResponse.prototype
        expect(res.render.call(res, 'TEST', function () {
          process.nextTick(function cb_nextTick() {
            var json     = transaction.trace.root.toJSON()
              , children = json[4]
              , render   = children[0]
              , name     = render[2]


            expect(name).equal('View/TEST/Rendering')
            transaction.end()

            return done()
          })
        })).equal('rendered')
      })
    })

    it("should trace http.ServerResponse.prototype.render when called with no callback",
       function (done) {
      should.exist(http.ServerResponse.prototype.render)
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()

        var res = http.ServerResponse.prototype
        expect(res.render.call(res, 'TEST')).equal('rendered')

        process.nextTick(function cb_nextTick() {
          var json     = transaction.trace.root.toJSON()
            , children = json[4]
            , render   = children[0]
            , name     = render[2]


          expect(name).equal('View/TEST/Rendering')
          transaction.end()

          return done()
        })
      })
    })

    it("should set the transaction's scope after matchRequest is called", function () {
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()
        transaction.verb = 'POST'

        var match = stub.createServer().routes._match
        expect(match()).eql({path : '/test/:id'})
        expect(transaction.partialName).equal('Expressjs/POST//test/:id')
      })
    })
  })

  describe("for Express 3 (stubbed)", function () {
    var agent
      , stub


    before(function () {
      agent = helper.instrumentMockedAgent()
      agent.environment.clearDispatcher()
      agent.environment.clearFramework()

      stub = {
        version : '3.1.4',
        application : {
          init : function () { return 'server'; }
        },
        response : {
          render : function (view, options, cb) {
            process.nextTick(cb)
            return 'rendered'
          },
          send : function () {}
        },
        Router : {
          prototype : {
            matchRequest : function () {
              return {path : 'test/:id'}
            }
          }
        }
      }

      require('../../../lib/instrumentation/express')(agent, stub)
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it("should set dispatcher to Express when a new app is created", function () {
      expect(stub.application.init()).equal('server')

      var dispatchers = agent.environment.get('Dispatcher')
      expect(dispatchers.length).equal(1)
      expect(dispatchers[0]).equal('express')
    })

    it("should set framework to Express when a new app is created", function () {
      expect(stub.application.init()).equal('server')

      var frameworks = agent.environment.get('Framework')
      expect(frameworks.length).equal(1)
      expect(frameworks[0]).equal('express')
    })

    it("should trace express.response.render", function (done) {
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()

        var res = stub.response
        expect(res.render.call(res, 'TEST', {}, function () {
          process.nextTick(function cb_nextTick() {
            var json     = transaction.trace.root.toJSON()
              , children = json[4]
              , render   = children[0]
              , name     = render[2]


            expect(name).equal('View/TEST/Rendering')
            transaction.end()

            return done()
          })
        })).equal('rendered')
      })
    })

    it("should trace express.response.render when called with no options",
       function (done) {
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()

        var res = stub.response
        expect(res.render.call(res, 'TEST', function () {
          process.nextTick(function cb_nextTick() {
            var json     = transaction.trace.root.toJSON()
              , children = json[4]
              , render   = children[0]
              , name     = render[2]


            expect(name).equal('View/TEST/Rendering')
            transaction.end()

            return done()
          })
        })).equal('rendered')
      })
    })

    it("should trace express.response.render when called with no callback",
       function (done) {
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()

        var res = stub.response
        expect(res.render.call(res, 'TEST')).equal('rendered')
        process.nextTick(function cb_nextTick() {
          var json     = transaction.trace.root.toJSON()
            , children = json[4]
            , render   = children[0]
            , name     = render[2]


          expect(name).equal('View/TEST/Rendering')
          transaction.end()

          return done()
        })
      })
    })

    it("should set the transaction's scope after matchRequest is called", function () {
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction()
        transaction.verb = 'GET'

        var match = stub.Router.prototype.matchRequest
        expect(match()).eql({path : 'test/:id'})
        expect(transaction.partialName).equal('Expressjs/GET//test/:id')
      })
    })
  })
})
