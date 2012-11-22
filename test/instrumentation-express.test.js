'use strict';

var path    = require('path')
  , chai    = require('chai')
  , should  = chai.should()
  , request = require('request')
  , helper  = require(path.join(__dirname, 'lib', 'agent_helper'))
  ;

describe("an instrumented Express application", function () {
  var app
    , runServer
    , stopServer
    , agent
    , fetchedResponse
    , fetchedBody
    , PORT = 8062
    ;

  before(function (done) {
    agent = helper.instrumentMockedAgent();

    // set apdexT so apdex stats will be recorded
    agent.apdexT = 1;

    var express = require('express');
    if (express.version[0] === '3') {
      app = express();

      var server;
      runServer = function (callback) {
        var http = require('http');

        server = http.createServer(app);
        server.listen(8062, callback);
      };

      stopServer = function (callback) {
        server.close(callback);
      };
    }
    else {
      app = express.createServer();

      runServer = function (callback) {
        app.listen(8062, callback);
      };

      stopServer = function (callback) {
        app.close(callback);
      };
    }

    app = express.createServer();
    app.get('/test-get', function (req, res) {
      res.send({yep : true});
    });

    runServer(function () {
      request.get('http://localhost:8062/test-get', function (error, response, body) {
        if (error) return done(error);

        fetchedResponse = response;
        fetchedBody = body;

        return done();
      });
    });
  });

  after(function () {
    stopServer();
    helper.unloadAgent(agent);
  });

  it("should serve content", function () {
    fetchedResponse.headers['content-type'].should.equal('application/json; charset=utf-8');
    JSON.parse(fetchedBody).should.deep.equal({"yep":true});
  });

  it("should record unscoped path statistics", function () {
    var stats = agent.metrics.getOrCreateMetric('WebTransaction/Uri/test-get').stats;
    stats.callCount.should.equal(1);
  });

  it("should record apdex without some low-level method-wrapping problem", function () {
    var stats = agent.metrics.getOrCreateApdexMetric('Apdex/Uri/test-get').stats;
    stats.satisfying.should.equal(1);
  });

  it("should roll up web transaction statistics", function () {
    var stats = agent.metrics.getOrCreateMetric('WebTransaction').stats;
    stats.callCount.should.equal(1);
  });

  it("should roll up HTTP dispatcher statistics", function () {
    var stats = agent.metrics.getOrCreateMetric('HttpDispatcher').stats;
    stats.callCount.should.equal(1);
  });

  it("should dump a JSON representation of its statistics", function () {
    JSON.stringify(agent.metrics).should.match(/WebTransaction\/Uri\/test-get/);
  });
});
