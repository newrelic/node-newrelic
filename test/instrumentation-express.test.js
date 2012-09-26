'use strict';

var path    = require('path')
  , chai    = require('chai')
  , should  = chai.should()
  , request = require('request')
  , helper  = require(path.join(__dirname, 'lib', 'agent_helper'))
  , shimmer = require(path.join(__dirname, '..', 'lib', 'shimmer'))
  ;

describe("an instrumented Express application", function () {
  var app
    , agent
    , fetchedResponse
    , fetchedBody
    , PORT = 8062
    ;

  before(function (done) {
    agent = helper.loadMockedAgent();
    shimmer.bootstrapInstrumentation(agent);

    // set apdexT so apdex stats will be recorded
    agent.metrics.apdexT = 1;

    var express = require('express');

    app = express.createServer();
    app.get('/test-get', function (req, res) {
      res.send({yep : true});
    });

    app.listen(8062, function () {
      request.get('http://localhost:8062/test-get', function (error, response, body) {
        if (error) return done(error);

        fetchedResponse = response;
        fetchedBody = body;

        return done();
      });
    });
  });

  after(function () {
    app.close();
    helper.unloadAgent(agent);
  });

  it("should serve content", function () {
    fetchedResponse.headers['content-type'].should.equal('application/json; charset=utf-8');
    fetchedBody.should.equal('{"yep":true}');
  });

  it("should record unscoped path statistics", function () {
    var stats = agent.metrics.getOrCreateMetric('WebTransaction/Uri/test-get').stats;
    stats.callCount.should.equal(1);
  });

  /**
   * This test case took three days to get running.
   */
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
