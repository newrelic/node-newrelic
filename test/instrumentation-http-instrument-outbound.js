'use strict';

var path   = require('path')
  , http   = require('http')
  , events = require('events')
  , chai   = require('chai')
  , expect = chai.expect
  , helper = require(path.join(__dirname, 'lib', 'agent_helper'))
  , NAMES  = require(path.join(__dirname, '..', 'lib', 'metrics', 'names.js'))
  , instrumentOutbound = require(path.join(__dirname, '..', 'lib', 'transaction',
                                           'tracer', 'instrumentation', 'outbound.js'))
  ;

describe("instrumentOutbound", function () {
  var agent
    , HOSTNAME = 'localhost'
    , PORT     = 8890
    ;

  before(function () {
    agent = helper.loadMockedAgent();
  });

  after(function () {
    helper.unloadAgent(agent);
  });

  describe("when working with http.createClient", function () {
    before(function () {
      // capture the deprecation warning here
      http.createClient();
    });

    function test(expectedPort, expectedHost, port, host) {
      var client = http.createClient(port,host);
      expect(client.port).equal(expectedPort);
      expect(client.host).equal(expectedHost);
    }

    it("should provide default port and hostname", function () {
      test(80, 'localhost');
    });

    it("should accept port and provide default hostname", function () {
      test(8080, 'localhost', 8080);
    });

    it("should accept port and hostname", function () {
      test(8080, 'me', 8080, 'me');
    });

    it("should set default port on null port", function () {
      test(80, 'me', null, 'me');
    });

    it("should provide default port and hostname on nulls", function () {
      test(80, 'localhost', null, null);
    });
  });

  it("should strip query parameters from path in transaction trace segment", function () {
    var req  = new events.EventEmitter();
    helper.runInTransaction(agent, function (transaction) {
      var path  = '/asdf'
        , name  = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path
        ;

      req.path  = '/asdf?a=b&another=yourself&thing&grownup=true';
      instrumentOutbound(agent, req, HOSTNAME, PORT);
      expect(transaction.getTrace().root.children[0].name).equal(name);
    });
  });

  it("should save query parameters from path if capture is defined", function () {
    var req  = new events.EventEmitter();
    helper.runInTransaction(agent, function (transaction) {
      agent.config.capture_params = true;
      req.path  = '/asdf?a=b&another=yourself&thing&grownup=true';
      instrumentOutbound(agent, req, HOSTNAME, PORT);
      expect(transaction.getTrace().root.children[0].parameters).deep.equal({
        "a"                            : "b",
        "nr_exclusive_duration_millis" : null,
        "another"                      : "yourself",
        "thing"                        : true,
        "grownup"                      : "true"
      });
    });
  });

  it("should not accept an undefined path", function () {
    var req  = new events.EventEmitter();
    helper.runInTransaction(agent, function () {
      expect(function () {
        instrumentOutbound(agent, req, HOSTNAME, PORT);
      }).to.throw(Error);
    });
  });

  it("should accept a simple path with no parameters", function () {
    var req  = new events.EventEmitter();
    helper.runInTransaction(agent, function (transaction) {
      var path  = '/newrelic'
        , name  = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path;
      req.path  = path;
      instrumentOutbound(agent, req, HOSTNAME, PORT);
      expect(transaction.getTrace().root.children[0].name).equal(name);
    });
  });

  it("should purge trailing slash", function () {
    var req  = new events.EventEmitter();
    helper.runInTransaction(agent, function (transaction) {
      var path  = '/newrelic/'
        , name  = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + '/newrelic';
      req.path  = path;
      instrumentOutbound(agent, req, HOSTNAME, PORT);
      expect(transaction.getTrace().root.children[0].name).equal(name);
    });
  });

  it("should throw if hostname is undefined", function () {
    var req  = new events.EventEmitter()
      , undef
      ;

    helper.runInTransaction(agent, function () {
      req.path = '/newrelic';
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, req, undef, PORT);
      }).to.throw(Error);
    });
  });

  it("should throw if hostname is null", function () {
    var req  = new events.EventEmitter()
      ;

    helper.runInTransaction(agent, function () {
      req.path = '/newrelic';
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, req, null, PORT);
      }).to.throw(Error);
    });
  });

  it("should throw if hostname is an empty string", function () {
    var req  = new events.EventEmitter();
    helper.runInTransaction(agent, function () {
      req.path = '/newrelic';
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, req, '', PORT);
      }).to.throw(Error);
    });
  });

  it("should throw if port is undefined", function () {
    var req  = new events.EventEmitter()
      , undef
      ;

    helper.runInTransaction(agent, function () {
      req.path = '/newrelic';
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, req, 'hostname', undef);
      }).to.throw(Error);
    });
  });

});
