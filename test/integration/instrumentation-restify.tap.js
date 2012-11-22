'use strict';

var path    = require('path')
  , tap     = require('tap')
  , test    = tap.test
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  ;

test("agent instrumentation of HTTP shouldn't crash when Restify handles a connection",
     function (t) {
  t.plan(8);

  var agent = helper.instrumentMockedAgent();

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

      var found = false;
      agent.environment.toJSON().forEach(function (pair) {
        if (pair[0] === 'Dispatcher' && pair[1] === 'restify') found = true;
      });
      t.ok(found, "should indicate that the Restify dispatcher is in play");

      found = false;
      agent.environment.toJSON().forEach(function (pair) {
        if (pair[0] === 'Framework' && pair[1] === 'restify') found = true;
      });
      t.ok(found, "should indicate that restify itself is in play");

      server.close(function () {
        helper.unloadAgent(agent);
        t.end();
      });
    });
  });
});
