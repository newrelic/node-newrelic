'use strict';

var path    = require('path')
  , test    = require('tap').test
  , helper  = require(path.join(__dirname, '..', '..', '..', 'lib', 'agent_helper'))
  , request = require('request')
  ;

var BODY = "<!DOCTYPE html>\n" +
           "<html>\n" +
           "<head>\n" +
           "  <title>yo dawg</title>\n" +
           "</head>\n" +
           "<body>\n" +
           "  <p>I heard u like HTML.</p>\n" +
           "</body>\n" +
           "</html>\n";

test("Express 2 with EJS templates",
     {timeout : 2000},
     function (t) {
  t.plan(3);

  var agent = helper.instrumentMockedAgent();

  var express = require('express')
    , app     = express.createServer()
    ;

  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.set('view options', {layout : false});

  app.get('/', function (req, res) {
    res.render('index', { title: 'yo dawg' });
  });

  app.listen(8765);

  this.tearDown(function () {
    app.close();
    helper.unloadAgent(agent);
  });

  agent.once('transactionFinished', function () {
    var stats = agent.metrics.getMetric('View/index/Rendering').stats;
    t.equal(stats.callCount, 1, "should note the view rendering");
  });

  request('http://localhost:8765/', function (error, response, body) {
    if (error) t.fail(error);

    t.equal(response.statusCode, 200, "response code should be 200");
    t.equal(body, BODY, "template should still render fine");

    t.end();
  });
});

test("agent instrumentation of Express should measure request duration properly (NA-46)",
     {timeout : 2 * 1000},
     function (t) {
  var TEST_PATH = '/test'
    , TEST_PORT = 9876
    , TEST_HOST = 'localhost'
    , TEST_URL  = 'http://' + TEST_HOST + ':' + TEST_PORT + TEST_PATH
    , DELAY     = 600
    , PAGE      = '<html>' +
                  '<head><title>test response</title></head>' +
                  '<body><p>I heard you like HTML.</p></body>' +
                  '</html>'
    ;

  var agent = helper.instrumentMockedAgent()
    , app   = require('express').createServer()
    ;

  this.tearDown(function () {
    app.close();
    helper.unloadAgent(agent);
  });

  app.get(TEST_PATH, function (request, response) {
    t.ok(agent.getTransaction(),
         "the transaction should be visible inside the Express handler");
    setTimeout(function () { response.send(PAGE); }, DELAY);
  });

  app.listen(TEST_PORT, TEST_HOST, function ready() {
    request.get(TEST_URL, function (error, response, body) {
      if (error) t.fail(error);

      t.ok(agent.environment.toJSON().some(function (pair) {
             return pair[0] === 'Dispatcher' && pair[1] === 'express';
           }),
           "should indicate that the Express dispatcher is in play");

      t.ok(agent.environment.toJSON().some(function (pair) {
             return pair[0] === 'Framework' && pair[1] === 'express';
           }),
           "should indicate that Express itself is in play");

      t.notOk(agent.getTransaction(), "transaction shouldn't be visible from request");
      t.equals(body, PAGE, "response and original page text match");

      var stats = agent.metrics.getMetric('WebTransaction/Uri/test').stats;
      t.ok(stats, "Statistics should have been found for request.");

      var timing = stats.total * 1000;
      t.ok(timing > DELAY - 50,
           "given some setTimeout slop, the request was long enough");

      t.end();
    });
  });
});
