'use strict';

var path   = require ('path')
  , tap    = require('tap')
  , test   = tap.test
  , helper = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper'))
  ;

// connect is a loudmouth without this
process.env.NODE_ENV = 'test';

test("intercepting errors with connect 1", function (t) {
  t.plan(3);

  t.test("should wrap handlers with proxies", function (t) {
    var agent   = helper.instrumentMockedAgent()
      , connect = require('connect')
      , app     = connect()
      ;

    this.tearDown(function () {
      helper.unloadAgent(agent);
    });

    function nop () {}

    app.use(nop);

    t.ok(app.stack, "there's a stack of handlers defined");
    // 2 because of the error handler
    t.equal(app.stack.length, 2, "have test middleware + error interceptor");

    var wrapNop = app.stack[0];
    t.equal(wrapNop.route, '', "nop handler defaults to all routes");
    t.ok(wrapNop.handle, "have nop handle passed above");
    t.equal(wrapNop.handle.name, 'nop', "nop's name is unchanged");
    t.equal(wrapNop.handle.__NR_original, nop, "nop is wrapped");

    // implementation detail: the sentinel
    var interceptor = app.stack[1];
    t.equal(interceptor.route, '', "interceptor catches all routes");
    t.ok(interceptor.handle, "interceptor has a handler");
    t.equal(interceptor.handle.name, 'sentinel', "error-wrapping sentinel found");

    t.end();
  });

  t.test("should have only one error interceptor in the middleware stack", function (t) {
    var agent   = helper.instrumentMockedAgent()
      , connect = require('connect')
      , app     = connect()
      ;

    this.tearDown(function () {
      helper.unloadAgent(agent);
    });

    app.use(connect.bodyParser());
    t.equal(app.stack.length, 2, "2 handlers after 1st add");
    t.equal(app.stack[app.stack.length - 1].handle.name, 'sentinel', "sentinel found");

    app.use(connect.cookieParser());
    t.equal(app.stack.length, 3, "3 handlers after 2nd add");
    t.equal(app.stack[app.stack.length - 1].handle.name, 'sentinel', "sentinel found");

    app.use(connect.csrf());
    t.equal(app.stack.length, 4, "4 handlers after 3rd add");
    t.equal(app.stack[app.stack.length - 1].handle.name, 'sentinel', "sentinel found");

    app.use(connect.logger());
    t.equal(app.stack.length, 5, "5 handlers after 4th add");
    t.equal(app.stack[app.stack.length - 1].handle.name, 'sentinel', "sentinel found");

    t.end();
  });

  t.test("should trace any errors that occur while executing a middleware stack",
         function (t) {
    var agent   = helper.instrumentMockedAgent()
      , connect = require('connect')
      , app     = connect()
      ;

    this.tearDown(function () {
      helper.unloadAgent(agent);
    });

    function wiggleware(req, res, next) {
      var harbl = null;
      harbl.bargl(); // OHHH NOOOOO

      return next(); // will never get here
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
        stubRes._end = agent.tracer.slice(arguments);
      }
    };

    app.use(wiggleware);
    app.handle(stubReq, stubRes);

    var errors = agent.errors.errors; // FIXME: redundancy is dumb
    t.equal(errors.length, 1, "the error got traced");

    var error = errors[0];
    t.equal(error.length, 5, "format for traced error is correct");
    t.equal(error[3], 'TypeError', "got the correct class for the error");

    t.end();
  });
});
