'use strict';

var path    = require('path')
  , chai    = require('chai')
  , should  = chai.should()
  , expect  = chai.expect
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  , shimmer = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  ;

describe("agent instrumentation of HTTP using Restify", function () {
  var agent
    , server
    ;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
    shimmer.bootstrapInstrumentation(agent);

    var restify = require('restify');

    server = restify.createServer();
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  it("shouldn't crash when Restify is initialized", function (done) {
    server.get('/hello/:name', function sayHello(req, res, next) {
      res.send('hello ' + req.params.name);
    });

    server.listen(8080, function () {
      should.not.exist(agent.getTransaction());

      request.get('http://localhost:8080/hello/friend', function (error, response, body) {
        if (error) return done(error);
        should.not.exist(agent.getTransaction());

        var metric = agent.metrics.getMetric('WebTransaction/Uri/hello/friend');
        should.exist(metric);
        expect(metric.stats.callCount, "number of calls").equal(1);
        expect(body, "data returned by restify").equal('"hello friend"');

        return done();
      });
    });
  });
});
