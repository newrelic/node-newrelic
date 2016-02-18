'use strict'

// shut up, Express
process.env.NODE_ENV = 'test'

var path = require('path')
var test = require('tap').test
var request = require('request')
var helper = require('../../lib/agent_helper')
var API = require('../../../api.js')
var skip = require('./skip')

var TEST_PATH = '/test'
var TEST_PORT = 9876
var TEST_HOST = 'localhost'
var TEST_URL = 'http://' + TEST_HOST + ':' + TEST_PORT + TEST_PATH
var DELAY = 600
var BODY = "<!DOCTYPE html>\n" +
           "<html>\n" +
           "<head>\n" +
           "  <title>yo dawg</title>\n" +
           "</head>\n" +
           "<body>\n" +
           "  <p>I heard u like HTML.</p>\n" +
           "</body>\n" +
           "</html>\n"


// Regression test for issue 154
// https://github.com/newrelic/node-newrelic/pull/154
test("using only the express router", {skip: skip()}, function (t) {
  var agent = helper.instrumentMockedAgent()
  var router = require('express').Router()

  this.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })

  router.get('/test', function () {
    //
  })

  router.get('/test2', function () {
    //
  })

  // just try not to blow up
  t.end()
})

test("the express router should go through a whole request lifecycle", {skip: skip()}, function (t) {
  var agent = helper.instrumentMockedAgent()
  var router = require('express').Router()
  var server

  t.plan(2)

  this.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })

  router.get('/test', function (_, res) {
    t.ok(true)
    res.end()
  })

  server = require('http').createServer(router)
  server.listen(8089, function(){
    request.get('http://localhost:8089/test', function (error, response, body) {
      server.close()

      t.ifError(error)
      t.end()
    })
  })
})

test("agent instrumentation of Express 4", {skip: skip()}, function (t) {
  t.plan(6)

  t.test("for a normal request", {timeout : 1000}, function (t) {
    var agent = helper.instrumentMockedAgent()
    var app = require('express')()
    var server = require('http').createServer(app)


    this.tearDown(function cb_tearDown() {
      server.close()
      helper.unloadAgent(agent)
    })

    // set apdexT so apdex stats will be recorded
    agent.config.apdex_t = 1

    app.get(TEST_PATH, function (req, res) {
      res.send({yep : true})
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL, function (error, response, body) {
        if (error) t.fail(error)

        t.ok(/application\/json/.test(response.headers['content-type']),
             "got correct content type")
        t.deepEqual(JSON.parse(body), {"yep":true}, "Express correctly serves.")

        var stats

        stats = agent.metrics.getMetric('WebTransaction/Expressjs/GET//test')
        t.ok(stats, "found unscoped stats for request path")
        t.equal(stats.callCount, 1, "/test was only requested once")

        stats = agent.metrics.getOrCreateApdexMetric('Apdex/Expressjs/GET//test')
        t.ok(stats, "found apdex stats for request path")
        t.equal(stats.satisfying, 1, "got satisfactory response time")
        t.equal(stats.tolerating, 0, "got no tolerable requests")
        t.equal(stats.frustrating, 0, "got no frustrating requests")

        stats = agent.metrics.getMetric('WebTransaction')
        t.ok(stats, "found roll-up statistics for web requests")
        t.equal(stats.callCount, 1, "only one web request was made")

        stats = agent.metrics.getMetric('HttpDispatcher')
        t.ok(stats, "found HTTP dispatcher statistics")
        t.equal(stats.callCount, 1, "only one HTTP-dispatched request was made")

        var serialized = JSON.stringify(agent.metrics)
        t.ok(serialized.match(/WebTransaction\/Expressjs\/GET\/\/test/),
             "serialized metrics as expected")

        t.end()
      })
    })
  })

  t.test("using EJS templates",
       {timeout : 1000},
       function (t) {
    var agent  = helper.instrumentMockedAgent()
    var app    = require('express')()
    var server = require('http').createServer(app)


    this.tearDown(function cb_tearDown() {
      server.close()
      helper.unloadAgent(agent)
    })

    app.set('views', __dirname + '/views')
    app.set('view engine', 'ejs')

    app.get(TEST_PATH, function (req, res) {
      res.render('index', { title: 'yo dawg' })
    })

    server.listen(TEST_PORT, TEST_HOST)

    agent.once('transactionFinished', function () {
      var stats = agent.metrics.getMetric('View/index/Rendering')
      t.equal(stats.callCount, 1, "should note the view rendering")
    })

    request(TEST_URL, function (error, response, body) {
      if (error) t.fail(error)

      t.equal(response.statusCode, 200, "response code should be 200")
      t.equal(body, BODY, "template should still render fine")

      t.end()
    })
  })

  t.test("should generate rum headers",
       {timeout : 1000},
       function (t) {
    var agent  = helper.instrumentMockedAgent()
    var app    = require('express')()
    var server = require('http').createServer(app)
    var api    = new API(agent)


    agent.config.application_id = '12345'
    agent.config.browser_monitoring.browser_key = '12345'
    agent.config.browser_monitoring.js_agent_loader = 'function(){}'

    this.tearDown(function cb_tearDown() {
      server.close()
      helper.unloadAgent(agent)
    })

    app.set('views', __dirname + '/views')
    app.set('view engine', 'ejs')

    app.get(TEST_PATH, function (req, res) {
      var rum = api.getBrowserTimingHeader()
      t.equal(rum.substr(0,7), '<script')
      res.render('index', { title: 'yo dawg', rum: rum })
    })

    server.listen(TEST_PORT, TEST_HOST)

    agent.once('transactionFinished', function () {
      var stats = agent.metrics.getMetric('View/index/Rendering')
      t.equal(stats.callCount, 1, "should note the view rendering")
    })

    request(TEST_URL, function (error, response, body) {
      if (error) t.fail(error)
      t.equal(response.statusCode, 200, "response code should be 200")
      t.equal(body, BODY, "template should still render fine")

      t.end()
    })
  })

  t.test("should trap errors correctly", function (t) {
    var agent = helper.instrumentMockedAgent()

    var app    = require('express')()
    var server = require('http').createServer(app)


    this.tearDown(function cb_tearDown() {
      server.close()
      helper.unloadAgent(agent)
    })

    app.get(TEST_PATH, function () {
      var hmm
      hmm.ohno.failure.is.terrible()
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      t.equal(app._router.stack.length, 4,
              "4 middleware functions: query parser, Express, router, error trapper")
      t.equal(app._router.stack[app._router.stack.length - 1].handle.name, 'sentinel',
              "error handler is last function in middleware chain")

      for (var i = 0; i < app._router.stack.length; i++) {
        var layer = app._router.stack[i]
        // route middleware doesn't have a name, sentinel is our error handler,
        // neither should be wrapped.
        if (layer.route === undefined && layer.handle.name !== 'sentinel') {
          t.equal(typeof layer.handle.__NR_original, 'function',
                  'all middlewares are wrapped')
        }
      }

      request.get(TEST_URL, function (error, response, body) {
        if (error) t.fail(error)

        t.ok(response, "got a response from Express")
        t.ok(body, "got back a body")

        var errors = agent.errors.errors
        t.ok(errors, "errors were found")
        t.equal(errors.length, 1, "Only one error thrown.")

        var first = errors[0]
        t.ok(first, "have the first error")

        t.equal(first[2], "Cannot read property 'ohno' of undefined",
                "got the expected error")

        t.end()
      })
    })
  })

  t.test("should measure request duration properly (NA-46)",
       {timeout : 2 * 1000},
       function (t) {
    var agent  = helper.instrumentMockedAgent()
    var app    = require('express')()
    var server = require('http').createServer(app)


    this.tearDown(function cb_tearDown() {
      server.close()
      helper.unloadAgent(agent)
    })

    app.get(TEST_PATH, function (request, response) {
      t.ok(agent.getTransaction(),
           "the transaction should be visible inside the Express handler")
           setTimeout(function () { response.send(BODY); }, DELAY)
    })

    server.listen(TEST_PORT, TEST_HOST, function ready() {
      request.get(TEST_URL, function (error, response, body) {
        if (error) t.fail(error)

        t.ok(agent.environment.toJSON().some(function cb_some(pair) {
          return pair[0] === 'Dispatcher' && pair[1] === 'express'
        }),
        "should indicate that the Express dispatcher is in play")

        t.ok(agent.environment.toJSON().some(function cb_some(pair) {
          return pair[0] === 'Framework' && pair[1] === 'express'
        }),
        "should indicate that Express itself is in play")

        t.notOk(agent.getTransaction(), "transaction shouldn't be visible from request")
        t.equals(body, BODY, "response and original page text match")

        var stats = agent.metrics.getMetric('WebTransaction/Expressjs/GET//test')
        t.ok(stats, "Statistics should have been found for request.")

        var timing = stats.total * 1000
        t.ok(timing > DELAY - 50,
             "given some setTimeout slop, the request was long enough")

        t.end()
      })
    })
  })

  t.test("should capture URL correctly when configured with a prefix",
         {timeout : 2 * 1000},
         function (t) {
    var agent  = helper.instrumentMockedAgent()
    var app    = require('express')()
    var server = require('http').createServer(app)


    this.tearDown(function cb_tearDown() {
      server.close()
      helper.unloadAgent(agent)
    })

    app.use(TEST_PATH, function (request, response) {
      t.ok(agent.getTransaction(),
           "the transaction should be visible inside the Express handler")
      t.equal('/ham', request.url)
      response.send(BODY)
    })

    server.listen(TEST_PORT, TEST_HOST, function ready() {
      request.get(TEST_URL + '/ham', function (error, response, body) {
        if (error) t.fail(error)

        t.notOk(agent.getTransaction(), "transaction shouldn't be visible from request")
        t.equals(body, BODY, "response and original page text match")

        var stats = agent.metrics.getMetric('WebTransaction/Expressjs/GET//')
        t.ok(stats, "Statistics should have been found for request.")

        t.end()
      })
    })
  })
})

test("trapping errors", {skip: skip()}, function (t) {

  t.test('collects the actual error object that is thrown', function(t) {
    var agent = helper.instrumentMockedAgent()

    var app    = require('express')()
    var server = require('http').createServer(app)

    this.tearDown(function cb_tearDown() {
      server.close()
      helper.unloadAgent(agent)
    })

    app.get(TEST_PATH, function() {
      throw new Error('some error')
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL, function (error, response, body) {
        var errors = agent.errors.errors
        t.equal(errors.length, 1, "there should be one error")
        t.equal(errors[0][2], "some error", "got the expected error")
        t.ok(errors[0][4].stack_trace, "has stack trace")

        var metric = agent.metrics.getMetric('Apdex')
        t.ok(metric.frustrating === 1, 'apdex should be frustrating')

        t.end()
      })
    })
  })

  t.test('collects the error message when string is thrown',
      function(t) {

    var agent = helper.instrumentMockedAgent()

    var app    = require('express')()
    var server = require('http').createServer(app)

    this.tearDown(function cb_tearDown() {
      server.close()
      helper.unloadAgent(agent)
    })

    app.get(TEST_PATH, function() {
      throw 'some error'
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL, function (error, response, body) {
        var errors = agent.errors.errors
        t.equal(errors.length, 1, "there should be one error")
        t.equal(errors[0][2], "some error", "got the expected error")

        var metric = agent.metrics.getMetric('Apdex')
        t.ok(metric.frustrating === 1, 'apdex should be frustrating')

        t.end()
      })
    })
  })

  t.test('collects the actual error object when error handler is used', function(t) {
    var agent = helper.instrumentMockedAgent()

    var app    = require('express')()
    var server = require('http').createServer(app)

    this.tearDown(function cb_tearDown() {
      server.close()
      helper.unloadAgent(agent)
    })

    app.get(TEST_PATH, function() {
      throw new Error('some error')
    })

    app.use(function errorHandler(err, rer, res, next) {
      res.status(400).end()
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL, function (error, response, body) {
        var errors = agent.errors.errors
        t.equal(errors.length, 1, "there should be one error")
        t.equal(errors[0][2], "some error", "got the expected error")
        t.ok(errors[0][4].stack_trace, "has stack trace")

        var metric = agent.metrics.getMetric('Apdex')
        t.ok(metric.frustrating === 1, 'apdex should be frustrating')

        t.end()
      })
    })
  })

  // Some error handlers might sanitize the error object, removing stack and/or message
  // properties, so that it can be serialized and sent back in the response body.
  // We use message and stack properties to identify an Error object, so in this case
  // we want to at least collect the HTTP error based on the status code.
  t.test('should trap errors when error handler sets HTTP status code and removes stack' +
      'and message properties from the error object', function(t) {

    var agent = helper.instrumentMockedAgent()

    var app    = require('express')()
    var server = require('http').createServer(app)

    this.tearDown(function cb_tearDown() {
      server.close()
      helper.unloadAgent(agent)
    })

    var error = new Error('some error')
    app.get(TEST_PATH, function () {
      throw error
    })

    app.use(function errorHandler(err, rer, res, next) {
      delete err.message
      delete err.stack
      res.status(400).send(err)
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL, function (error, response, body) {
        var errors = agent.errors.errors
        t.equal(errors.length, 1, "there should be one error")
        t.equal(errors[0][2], "HttpError 400", "got the expected error")

        var metric = agent.metrics.getMetric('Apdex')
        t.ok(metric.frustrating === 1, 'apdex should be frustrating')

        t.end()
      })
    })
  })

  t.test('should trap errors when error handler sets HTTP status code and removes stack' +
      'and message properties from the error object', function(t) {

    var agent = helper.instrumentMockedAgent()

    var app    = require('express')()
    var server = require('http').createServer(app)

    this.tearDown(function cb_tearDown() {
      server.close()
      helper.unloadAgent(agent)
    })

    var error = new Error('some error')
    app.get(TEST_PATH, function () {
      throw error
    })

    app.use(function errorHandler(err, rer, res, next) {
      delete err.message
      delete err.stack
      next(err)
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL, function (error, response, body) {
        var errors = agent.errors.errors
        t.equal(errors.length, 1, "there should be one error")
        t.equal(errors[0][2], "HttpError 500", "got the expected error")

        var metric = agent.metrics.getMetric('Apdex')
        t.ok(metric.frustrating === 1, 'apdex should be frustrating')

        t.end()
      })
    })
  })
})
