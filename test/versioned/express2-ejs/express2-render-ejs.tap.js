'use strict';

// shut up, Express
process.env.NODE_ENV = 'test';

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , shimmer = require(path.join(__dirname, '..', '..', '..', 'lib', 'shimmer'))
  , helper  = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper'))
  , API     = require(path.join('..', '..', '..', 'api.js'))
  ;

var TEST_PATH = '/test'
  , TEST_PORT = 9876
  , TEST_HOST = 'localhost'
  , TEST_URL  = 'http://' + TEST_HOST + ':' + TEST_PORT + TEST_PATH
  , DELAY     = 600
  , BODY      = "<!DOCTYPE html>\n" +
                "<html>\n" +
                "<head>\n" +
                "  <title>yo dawg</title>\n" +
                "</head>\n" +
                "<body>\n" +
                "  <p>I heard u like HTML.</p>\n" +
                "</body>\n" +
                "</html>\n"
  ;

test("agent instrumentation of Express 2", function (t) {
  t.plan(6);

  t.test("for a normal request", {timeout : 1000}, function (t) {
    var agent = helper.instrumentMockedAgent()
      , app   = require('express').createServer()
      ;

    this.tearDown(function () {
      app.close();
      helper.unloadAgent(agent);
    });

    // set apdexT so apdex stats will be recorded
    agent.config.apdex_t = 1;

    app.get(TEST_PATH, function (req, res) {
      res.send({yep : true});
    });

    app.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL, function (error, response, body) {
        if (error) t.fail(error);

        var contentType = 'application/json; charset=utf-8';
        t.equal(response.headers['content-type'], contentType,
                "got correct content type");
        t.deepEqual(JSON.parse(body), {"yep":true}, "Express correctly serves.");

        var stats;

        stats = agent.metrics.getMetric('WebTransaction/Expressjs/GET//test');
        t.ok(stats, "found unscoped stats for request path");
        t.equal(stats.callCount, 1, "/test was only requested once");

        stats = agent.metrics.getOrCreateApdexMetric('Apdex/Expressjs/GET//test');
        t.ok(stats, "found apdex stats for request path");
        t.equal(stats.satisfying, 1, "got satisfactory response time");
        t.equal(stats.tolerating, 0, "got no tolerable requests");
        t.equal(stats.frustrating, 0, "got no frustrating requests");

        stats = agent.metrics.getMetric('WebTransaction');
        t.ok(stats, "found roll-up statistics for web requests");
        t.equal(stats.callCount, 1, "only one web request was made");

        stats = agent.metrics.getMetric('HttpDispatcher');
        t.ok(stats, "found HTTP dispatcher statistics");
        t.equal(stats.callCount, 1, "only one HTTP-dispatched request was made");

        var serialized = JSON.stringify(agent.metrics);
        t.ok(serialized.match(/WebTransaction\/Expressjs\/GET\/\/test/),
             "serialized metrics as expected");

        t.end();
      });
    });
  });

  t.test("using EJS templates",
       {timeout : 1000},
       function (t) {
    var agent = helper.instrumentMockedAgent()
      , app   = require('express').createServer()
      ;

    this.tearDown(function () {
      app.close();
      helper.unloadAgent(agent);
    });

    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.set('view options', {layout : false});

    app.get(TEST_PATH, function (req, res) {
      res.render('index', { title: 'yo dawg' });
    });

    app.listen(TEST_PORT, TEST_HOST);

    agent.once('transactionFinished', function () {
      var stats = agent.metrics.getMetric('View/index/Rendering');
      t.equal(stats.callCount, 1, "should note the view rendering");
    });

    request(TEST_URL, function (error, response, body) {
      if (error) t.fail(error);

      t.equal(response.statusCode, 200, "response code should be 200");
      t.equal(body, BODY, "template should still render fine");

      t.end();
    });
  });

  t.test("should generate rum headers",
       {timeout : 1000},
       function (t) {
    var agent = helper.instrumentMockedAgent()
      , app   = require('express').createServer()
      , api   = new API(agent)
      ;

    agent.config.application_id = '12345';
    agent.config.browser_monitoring.browser_key = '12345';

    this.tearDown(function () {
      app.close();
      helper.unloadAgent(agent);
    });

    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.set('view options', {layout : false});

    app.get(TEST_PATH, function (req, res) {
      var rum = api.getBrowserTimingHeader();
      t.equal(rum.substr(0,7), '<script');
      res.render('index', { title: 'yo dawg', rum: rum });
    });

    app.listen(TEST_PORT, TEST_HOST);

    agent.once('transactionFinished', function () {
      var stats = agent.metrics.getMetric('View/index/Rendering');
      t.equal(stats.callCount, 1, "should note the view rendering");
    });

    request(TEST_URL, function (error, response, body) {
      if (error) t.fail(error);

      t.equal(response.statusCode, 200, "response code should be 200");
      t.equal(body, BODY, "template should still render fine");

      t.end();
    });
  });

  t.test("should trap errors correctly",
         {timeout : 1000},
         function (t) {
    var agent = helper.instrumentMockedAgent();

    // see shimmer.reinstrument for info on why this is here
    shimmer.reinstrument(
      agent,
      path.join(__dirname, 'node_modules', 'express', 'node_modules', 'connect')
    );

    var app = require('express').createServer();

    this.tearDown(function () {
      app.close();
      helper.unloadAgent(agent);
    });

    app.get(TEST_PATH, function () {
      var hmm;
      hmm.ohno.failure.is.terrible();
    });

    app.listen(TEST_PORT, TEST_HOST, function () {
      t.equal(app.stack.length, 3,
              "3 middleware functions: Express, router, error trapper");
      t.equal(app.stack[app.stack.length - 1].handle.name, 'sentinel',
              "error handler is last function in middleware chain");

      request.get(TEST_URL, function (error, response, body) {
        if (error) t.fail(error);

        t.ok(response, "got a response from Express");
        t.ok(body, "got back a body");

        var errors = agent.errors.errors;
        t.ok(errors, "errors were found");
        t.equal(errors.length, 1, "Only one error thrown.");

        var first = errors[0];
        t.ok(first, "have the first error");

        t.equal(first[2], "Cannot read property 'ohno' of undefined",
                "got the expected error");

        t.end();
      });
    });
  });

  t.test("should measure request duration properly (NA-46)",
         {timeout : 2 * 1000},
         function (t) {
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
      setTimeout(function () { response.send(BODY); }, DELAY);
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
        t.equals(body, BODY, "response and original page text match");

        var stats = agent.metrics.getMetric('WebTransaction/Expressjs/GET//test');
        t.ok(stats, "Statistics should have been found for request.");

        var timing = stats.total * 1000;
        t.ok(timing > DELAY - 50,
             "given some setTimeout slop, the request was long enough");

        t.end();
      });
    });
  });

  t.test("should capture URL correctly when configured with a prefix",
         {timeout : 2 * 1000},
         function (t) {
    var agent = helper.instrumentMockedAgent()
      , app   = require('express').createServer()
      ;

    this.tearDown(function () {
      app.close();
      helper.unloadAgent(agent);
    });

    app.use(TEST_PATH, function (request, response) {
      t.ok(agent.getTransaction(),
           "the transaction should be visible inside the Express handler");
      t.equal('/ham', request.url);
      response.send(BODY);
    });

    app.listen(TEST_PORT, TEST_HOST, function ready() {
      request.get(TEST_URL + '/ham', function (error, response, body) {
        if (error) t.fail(error);

        t.notOk(agent.getTransaction(), "transaction shouldn't be visible from request");
        t.equals(body, BODY, "response and original page text match");

        var stats = agent.metrics.getMetric('WebTransaction/NormalizedUri/*');
        t.ok(stats, "Statistics should have been found for request.");

        t.end();
      });
    });
  });
});
