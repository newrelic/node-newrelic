'use strict';

var path    = require('path')
  , tap     = require('tap')
  , test    = tap.test
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  , shimmer = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  ;

test("agent instrumentation of Express should measure request duration properly (NA-46)",
     {timeout : 5 * 1000},
     function (t) {
  t.plan(4);

  var agent = helper.loadMockedAgent();
  shimmer.bootstrapInstrumentation(agent);

  // express.createServer() went away sometime after Express 2.4.3
  // Customer in NA-46 is / was using Express 2.4.3
  var app = require('express').createServer();

  var TEST_PATH = '/test'
    , TEST_PORT = 9876
    , TEST_HOST = 'localhost'
    , TEST_URL  = 'http://' + TEST_HOST + ':' + TEST_PORT + TEST_PATH
    , DELAY     = 2100
    , PAGE      = '<html>' +
                  '<head><title>test response</title></head>' +
                  '<body><p>I heard you like HTML.</p></body>' +
                  '</html>'
    ;

  app.get(TEST_PATH, function (request, response) {
    t.ok(agent.getTransaction(), "the transaction should be visible inside the Express handler");
    response.writeHead(200, {'Content-Length' : PAGE.length,
                             'Content-Type'   : 'text/html'});
    setTimeout(function () { response.end(PAGE); }, DELAY);
  });

  app.listen(TEST_PORT, TEST_HOST, function ready() {
    request.get(TEST_URL, function (error, response, body) {
      if (error) t.fail(error);
      t.notOk(agent.getTransaction(), "transaction shouldn't be visible from request");

      t.equals(body, PAGE, "response and original page text match");
      var timing = agent.metrics.getMetric('WebTransaction/Uri/test').stats.total * 1000;
      t.ok(timing > DELAY - 100, "given some setTimeout slop, the request was long enough");

      app.close(function shutdown() {
        helper.unloadAgent(agent);
        t.end();
      });
    });
  });
});
