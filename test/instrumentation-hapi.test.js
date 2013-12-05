'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("an instrumented Hapi application", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize
      ;

    before(function () {
      agent = helper.loadMockedAgent();
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'hapi'));
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("when passed nothing", function () {
      expect(function () { initialize(); }).not.throws();
    });

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws();
    });

    it("when passed an empty module", function () {
      initialize(agent, {});
      expect(function () { initialize(agent, {}); }).not.throws();
    });
  });

  describe("when stubbed", function () {
    var agent
      , stub
      ;

    beforeEach(function () {
      agent = helper.instrumentMockedAgent();
      agent.environment.clearDispatcher();
      agent.environment.clearFramework();

      stub = {
        Server : {
          prototype : {
            start  : function () { return 'server'; },
            views  : function () {},
            _route : function () {}
          }
        }
      };

      require(path.join(__dirname, '..', 'lib',
                        'instrumentation', 'hapi'))(agent, stub);
    });

    afterEach(function () {
      helper.unloadAgent(agent);
    });

    it("should set dispatcher to Hapi when a new app is created", function () {
      expect(stub.Server.prototype.start()).equal('server');

      var dispatchers = agent.environment.get('Dispatcher');
      expect(dispatchers.length).equal(1);
      expect(dispatchers[0]).equal('hapi');
    });

    it("should set framework to Hapi when a new app is created", function () {
      expect(stub.Server.prototype.start()).equal('server');

      var frameworks = agent.environment.get('Framework');
      expect(frameworks.length).equal(1);
      expect(frameworks[0]).equal('hapi');
    });

    it("should know the transaction's scope after calling handler", function (done) {
      var TEST_PATH = '/test/{id}';

      helper.runInTransaction(agent, function (transaction) {
        transaction.verb = 'GET';

        var config = {
          path : TEST_PATH,
          handler : function handler() {
            expect(transaction.partialName).equal('Hapi/GET//test/{id}');
            done();
          }
        };

        stub.Server.prototype._route(config);

        var request = {
          route : {
            path : TEST_PATH
          }
        };

        config.handler(request);

        transaction.end();
      });
    });

    it("should set the transaction's parameters after calling handler", function (done) {

      helper.runInTransaction(agent, function (transaction) {
        transaction.agent.config.capture_params = true;

        var config = {
          handler : function handler() {
            expect(transaction.getTrace().root.parameters).eql({
              id                           : '31337',
              type                         : 'box',
              nr_exclusive_duration_millis : null
            });

            done();
          }
        };

        stub.Server.prototype._route(config);

        var request = {
          route : {
            path : '/nonexistent'
          },
          params : {
            id   : '31337',
            type : 'box'
          }
        };

        config.handler(request);

        transaction.end();
      });
    });
  });
});
