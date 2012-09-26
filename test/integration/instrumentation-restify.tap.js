'use strict';

var path    = require('path')
  , tap     = require('tap')
  , test    = tap.test
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  , shimmer = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  ;

test("agent instrumentation of HTTP shouldn't crash when Restify handles a connection",
     function (t) {
  t.plan(6);

  var agent = helper.loadMockedAgent();
  shimmer.bootstrapInstrumentation(agent);

  var restify = require('restify');
  var server = restify.createServer();

  server.get('/hello/:name', function sayHello(req, res, next) {
    t.ok(agent.getTransaction(), "transaction should be available in handler");
    res.send('hello ' + req.params.name);
  });

  server.listen(8765, function () {
    t.notOk(agent.getTransaction(), "transaction shouldn't leak into server");

    request.get('http://localhost:8765/hello/friend', function (error, response, body) {
      if (error) return t.fail(error);
      t.notOk(agent.getTransaction(), "transaction shouldn't leak into external request");

      var metric = agent.metrics.getMetric('WebTransaction/Uri/hello/friend');
      t.ok(metric, "request metrics should have been gathered");
      t.equals(metric.stats.callCount, 1, "handler should have been called");
      t.equals(body, '"hello friend"', "data returned by restify should be as expected");

      server.close(function () {
        helper.unloadAgent(agent);
        t.end();
      });
    });
  });
});
