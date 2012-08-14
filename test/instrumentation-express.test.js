'use strict';

var path    = require('path')
  , chai    = require('chai')
  , should  = chai.should()
  , request = require('request')
  , helper  = require(path.join(__dirname, 'lib', 'agent_helper'))
  , logger  = require(path.join(__dirname, '..', 'lib', 'logger'))
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
    // set apdexT so apdex stats will be recorded
    agent.statsEngine.apdexT = 1;

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

  after(function (done) {
    app.close();
    helper.unloadAgent(agent);

    return done();
  });

  it("should serve content", function (done) {
    fetchedResponse.headers['content-type'].should.equal('application/json; charset=utf-8');
    fetchedBody.should.equal('{"yep":true}');

    return done();
  });

  it("should record unscoped path statistics", function (done) {
    var summary = agent.statsEngine.unscopedStats.byName('WebTransaction/Uri/test-get').toJSON();
    summary[0].should.equal(1);

    return done();
  });

  /**
   * This test case took three days to get running.
   */
  it("should record apdex without some low-level method-wrapping problem", function (done) {
    var summary = agent.statsEngine.unscopedStats.getApdexStats('Apdex/Uri/test-get').toJSON();
    summary[0].should.equal(1);

    return done();
  });

  it("should roll up web transaction statistics", function (done) {
    var summary = agent.statsEngine.unscopedStats.byName('WebTransaction').toJSON();
    summary[0].should.equal(1);

    return done();
  });

  it("should roll up HTTP dispatcher statistics", function (done) {
    var summary = agent.statsEngine.unscopedStats.byName('HttpDispatcher').toJSON();
    summary[0].should.equal(1);

    return done();
  });
});
