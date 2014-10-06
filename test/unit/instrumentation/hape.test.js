'use strict'

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , helper = require('../../lib/agent_helper')
  

describe("an instrumented Hapi application", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize
      

    before(function () {
      agent = helper.loadMockedAgent()
      initialize = require('../../../lib/instrumentation/hapi')
    })

    after(function () {
      helper.unloadAgent(agent)
    })

    it("when passed nothing", function () {
      expect(function () { initialize(); }).not.throws()
    })

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws()
    })

    it("when passed an empty module", function () {
      initialize(agent, {})
      expect(function () { initialize(agent, {}); }).not.throws()
    })
  })

  describe("when stubbed", function () {
    var agent
      , stub
      

    beforeEach(function () {
      agent = helper.instrumentMockedAgent()
      agent.environment.clearDispatcher()
      agent.environment.clearFramework()

      function Router() {
        this.table = {}
      }
      Router.prototype.add = function add(config) {
        this.table[config.method] = [{settings : config}]
      }

      function Server() {
        this._router = new Router()
      }
      Server.prototype = {
        start  : function () { return 'server'; },
        views  : function () {},
        _route : function (config) { this._router.add(config); }
      }

      stub = {Server : Server}

      require('../../../lib/instrumentation/hapi')(agent, stub)
    })

    afterEach(function () {
      helper.unloadAgent(agent)
    })

    it("should set dispatcher to Hapi when a new app is created", function () {
      expect(stub.Server.prototype.start()).equal('server')

      var dispatchers = agent.environment.get('Dispatcher')
      expect(dispatchers.length).equal(1)
      expect(dispatchers[0]).equal('hapi')
    })

    it("should set framework to Hapi when a new app is created", function () {
      expect(stub.Server.prototype.start()).equal('server')

      var frameworks = agent.environment.get('Framework')
      expect(frameworks.length).equal(1)
      expect(frameworks[0]).equal('hapi')
    })

    it("should know the transaction's scope after calling handler", function (done) {
      var TEST_PATH = '/test/{id}'

      helper.runInTransaction(agent, function (transaction) {
        transaction.verb = 'GET'

        var config = {
          method : 'GET',
          path : TEST_PATH,
          handler : function handler() {
            expect(transaction.partialName).equal('Hapi/GET//test/{id}')
            done()
          }
        }

        var server = new stub.Server()
        server._route(config)

        var request = {
          route : {
            path : TEST_PATH
          }
        }

        config.handler(request)

        transaction.end()
      })
    })

    it("should set the transaction's parameters after calling handler", function (done) {

      helper.runInTransaction(agent, function (transaction) {
        transaction.agent.config.capture_params = true

        var config = {
          method : 'GET',
          path : '/nonexistent',
          handler : function handler() {
            expect(transaction.getTrace().root.parameters).eql({
              id                           : '31337',
              type                         : 'box',
              nr_exclusive_duration_millis : null
            })

            done()
          }
        }

        var server = new stub.Server()
        server._route(config)

        var request = {
          route : {
            path : '/nonexistent'
          },
          params : {
            id   : '31337',
            type : 'box'
          }
        }

        config.handler(request)

        transaction.end()
      })
    })
  })
})
