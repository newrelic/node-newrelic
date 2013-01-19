'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("an instrumented Connect stack", function () {
  describe("shouldn't cause bootstrapping to fail", function () {
    var agent
      , initialize
      ;

    before(function () {
      agent = helper.loadMockedAgent();
      initialize = require(path.join(__dirname, '..', 'lib',
                                     'instrumentation', 'connect'));
    });

    it("when passed no module", function () {
      expect(function () { initialize(agent); }).not.throws();
    });

    it("when passed an empty module", function () {
      initialize(agent, {});
      expect(function () { initialize(agent, {}); }).not.throws();
    });
  });

  describe("when passed middleware", function () {
    var agent
      , app
      ;

    beforeEach(function () {
      agent = helper.instrumentMockedAgent();

      var connect = require('connect');
      app = connect();
    });

    afterEach(function () {
      helper.unloadAgent(agent);
    });

    it("should wrap functions with transaction proxies", function () {
      app.use(function () {});

      should.exist(app.stack);
      // 2 because of the error handler
      expect(app.stack.length).equal(2);

      should.exist(app.stack[0].handle);
      expect(app.stack[0].handle.name).equal('wrappedConnectHandle');

      // implementation detail: the sentinel
      should.exist(app.stack[1].handle);
      expect(app.stack[1].route).equal('');
      expect(app.stack[1].handle.name).equal('sentinel');
    });

    it("should only have one interceptor in the middleware stack");

    it("should trace any errors that occur while executing a middleware stack",
       function () {
      function wiggleware(req, res, next) {
        var harbl = null;
        harbl.bargl();

        return next();
      }

      var stubReq = {
        url : '/test',
        method : 'GET'
      };

      var stubRes = {
        headers : {},
        setHeader : function (name, value) {
          stubRes.headers[name] = value;
        },
        end : function () {
          stubRes._end = Array.prototype.slice(arguments);
        }
      };

      app.use(wiggleware);
      app.handle(stubReq, stubRes);

      expect(agent.errors.errors.length).equal(1);
      expect(agent.errors.errors[0][3]).equal('TypeError');
    });
  });
});
