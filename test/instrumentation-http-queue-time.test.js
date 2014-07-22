'use strict';

var path         = require('path')
  , assert       = require('assert')
  , chai         = require('chai')
  , http         = require('http')
  , should       = chai.should()
  , expect       = chai.expect
  , EventEmitter = require('events').EventEmitter
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("built-in http queueTime", function () {
  var agent
    , testDate
    , testTime
    , PORT
    ;

  before(function () {
    agent = helper.instrumentMockedAgent();
    testDate = Date.now();
    testTime = testDate - testVal;
    PORT = 0
  });

  after(function () {
    helper.unloadAgent(agent);
  });

  var testVal = 1000;

  it("x-request should verify milliseconds", function (done) {
    var server;

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime;
      assert(transTime > 0, 'must be positive');
      assert(transTime < 2000, 'should have correct order');
      response.end();
    });

    server.listen(PORT, function () {
      var port = server.address().port
      var opts = {host : 'localhost', port : port, headers: {
        "x-request-start": testTime
      }
    };
      http.get(opts, function () {

        server.close();
        return done();
      });
    });
  });

  it("x-queue should verify milliseconds", function (done) {
    var server;

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime;
      assert(transTime > 0, 'must be positive');
      assert(transTime < 2000, 'should have correct order');
      response.end();
    });

    server.listen(PORT, function () {
      var port = server.address().port
      var opts = {host : 'localhost', port : port, headers: {
        "x-queue-start": testTime
      }
    };
      http.get(opts, function () {

        server.close();
        return done();
      });
    });
  });

  it("x-request should verify microseconds", function (done) {
    var server;

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime;
      assert(transTime > 0, 'must be positive');
      assert(transTime < 2000, 'should have correct order');
      response.end();
    });

    server.listen(PORT, function () {
      var port = server.address().port
      var opts = {host : 'localhost', port : port, headers: {
        "x-request-start": testTime * 1e3
      }};
      http.get(opts, function () {

        server.close();
        return done();
      });
    });
  });

  it("x-queue should verify nanoseconds", function (done) {
    var server;

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime;
      assert(transTime > 0, 'must be positive');
      assert(transTime < 2000, 'should have correct order');
      response.end();
    });

      server.listen(PORT, function () {
        var port = server.address().port
        var opts = {host : 'localhost', port : port, headers: {
        "x-queue-start": testTime * 1e6
      }};
      http.get(opts, function () {

        server.close();
        return done();
      });
    });
  });

  it("x-request should verify seconds", function (done) {
    var server;

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime;
      assert(transTime > 0, 'must be positive');
      assert(transTime < 2000, 'should have correct order');
      response.end();
    });

    server.listen(PORT, function () {
      var port = server.address().port
      var opts = {host : 'localhost', port : port, headers: {
        "x-request-start": testTime / 1e3
      }};
      http.get(opts, function () {

        server.close();
        return done();
      });
    });
  });
});
