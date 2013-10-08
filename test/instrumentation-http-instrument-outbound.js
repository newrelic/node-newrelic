'use strict';

var path   = require('path')
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
  
  it("should not accept an undefined path", function () {
    var req  = new events.EventEmitter();
    helper.runInTransaction(agent, function (transaction) {
      var name  = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + '/';
      
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
