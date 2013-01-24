'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("an instrumented Express application", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize
      ;

    before(function () {
      agent = helper.loadMockedAgent();
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'express'));
    });

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws();
    });

    it("when passed an empty module", function () {
      initialize(agent, {});
      expect(function () { initialize(agent, {}); }).not.throws();
    });
  });

  describe("for Express 2 (mocked)", function () {
    var agent
      , stub
      , http
      ;

    before(function () {
      agent = helper.instrumentMockedAgent();

      stub = {
        version : '2.5.3',
        createServer : function () { return 'server'; }
      };

      http = require('http');
      should.not.exist(http.ServerResponse.prototype.render);
      http.ServerResponse.prototype.render = function (view, options, cb) {
        process.nextTick(cb);
        return 'rendered';
      };

      require(path.join(__dirname, '..', 'lib',
                        'instrumentation', 'express'))(agent, stub);
    });

    after(function () {
      helper.unloadAgent(agent);
      delete http.ServerResponse.prototype.render;
    });

    it("should set dispatcher to Express when a new server is created", function () {
      expect(stub.createServer()).equal('server');

      var dispatchers = agent.environment.get('Dispatcher');
      expect(dispatchers.length).equal(1);
      expect(dispatchers[0]).equal('express');
    });

    it("should set framework to Express when a new server is created", function () {
      expect(stub.createServer()).equal('server');

      var frameworks = agent.environment.get('Framework');
      expect(frameworks.length).equal(1);
      expect(frameworks[0]).equal('express');
    });

    it("should wrap http.ServerResponse.prototype.render", function (done) {
      should.exist(http.ServerResponse.prototype.render);
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction();

        expect(http.ServerResponse.prototype.render.call(null,
                                                         'TEST',
                                                         {},
                                                         function () {
          process.nextTick(function () {
            var json = transaction.getTrace().root.toJSON();
            expect(json[4][0][2]).equal('View/TEST/Rendering');

            return done();
          });
        })).equal('rendered');
      });
    });

    it("should wrap http.ServerResponse.prototype.render with missing options",
       function (done) {
      should.exist(http.ServerResponse.prototype.render);
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction();

        expect(http.ServerResponse.prototype.render.call(null,
                                                         'TEST',
                                                         function () {
          process.nextTick(function () {
            var json = transaction.getTrace().root.toJSON();
            expect(json[4][0][2]).equal('View/TEST/Rendering');

            return done();
          });
        })).equal('rendered');
      });
    });
  });

  describe("for Express 3 (mocked)", function () {
    var agent
      , stub
      ;

    before(function () {
      agent = helper.instrumentMockedAgent();

      stub = {
        version : '3.1.4',
        application : {
          init : function () { return 'server'; }
        },
        response : {
          render : function (view, options, cb) {
            process.nextTick(cb);
            return 'rendered';
          }
        }
      };

      require(path.join(__dirname, '..', 'lib',
                        'instrumentation', 'express'))(agent, stub);
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("should set dispatcher to Express when a new app is created", function () {
      expect(stub.application.init()).equal('server');

      var dispatchers = agent.environment.get('Dispatcher');
      expect(dispatchers.length).equal(1);
      expect(dispatchers[0]).equal('express');
    });

    it("should set framework to Express when a new app is created", function () {
      expect(stub.application.init()).equal('server');

      var frameworks = agent.environment.get('Framework');
      expect(frameworks.length).equal(1);
      expect(frameworks[0]).equal('express');
    });

    it("should wrap express.response.render", function (done) {
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction();

        expect(stub.response.render.call(null, 'TEST', {}, function () {
          process.nextTick(function () {
            var json = transaction.getTrace().root.toJSON();
            expect(json[4][0][2]).equal('View/TEST/Rendering');

            return done();
          });
        })).equal('rendered');
      });
    });

    it("should wrap express.response.render with a missing options",
       function (done) {
      helper.runInTransaction(agent, function () {
        var transaction = agent.getTransaction();

        expect(stub.response.render.call(null, 'TEST', function () {
          process.nextTick(function () {
            var json = transaction.getTrace().root.toJSON();
            expect(json[4][0][2]).equal('View/TEST/Rendering');

            return done();
          });
        })).equal('rendered');
      });
    });
  });
});
