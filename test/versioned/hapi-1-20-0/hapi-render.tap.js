'use strict'

// hapi 1.20.0 depends on node 0.10.x
if (process.version.split('.')[1] < 10) {
  console.log('TAP version 13\n# disabled because of incompatibility')
  console.log('ok 1 nothing to do\n\n1..1\n\n# ok')
  process.exit(0)
}

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require('../../lib/agent_helper')
  , API     = require('../../../api.js')
  

var TEST_PATH = '/test'
  , TEST_PORT = 9876
  , TEST_HOST = 'localhost'
  , TEST_URL  = 'http://' + TEST_HOST + ':' + TEST_PORT + TEST_PATH
  , BODY      = "<!DOCTYPE html>\n" +
                "<html>\n" +
                "<head>\n" +
                "  <title>yo dawg</title>\n" +
                "</head>\n" +
                "<body>\n" +
                "  <p>I heard u like HTML.</p>\n" +
                "</body>\n" +
                "</html>\n"
  

test("agent instrumentation of Hapi", function (t) {
  t.plan(4)

  t.test("for a normal request", {timeout : 1000}, function (t) {
    var agent  = helper.instrumentMockedAgent()
      , hapi   = require('hapi')
      , server = hapi.createServer(TEST_HOST, TEST_PORT)
      

    // set apdexT so apdex stats will be recorded
    agent.config.apdex_t = 1

    server.route({
      method  : 'GET',
      path    : TEST_PATH,
      handler : function () {
        this.reply({yep : true})
      }
    })

    server.start(function cb_start() {
      request.get(TEST_URL, function (error, response, body) {
        if (error) t.fail(error)

        t.ok(/application\/json/.test(response.headers['content-type']),
             "got correct content type")
        t.deepEqual(JSON.parse(body), {"yep":true}, "response survived")

        var stats

        stats = agent.metrics.getMetric('WebTransaction/Hapi/GET//test')
        t.ok(stats, "found unscoped stats for request path")
        t.equal(stats.callCount, 1, "/test was only requested once")

        stats = agent.metrics.getOrCreateApdexMetric('Apdex/Hapi/GET//test')
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
        t.ok(serialized.match(/WebTransaction\/Hapi\/GET\/\/test/),
             "serialized metrics as expected")

        server.stop(function cb_stop() {
          helper.unloadAgent(agent)
          t.end()
        })
      })
    })
  })

  t.test("using EJS templates",
       {timeout : 1000},
       function (t) {
    var agent  = helper.instrumentMockedAgent()
      , hapi   = require('hapi')
      

    var options = {
      views : {
        path : path.join(__dirname, 'views'),
        engines : {
          ejs : 'ejs'
        }
      }
    }

    var server = hapi.createServer(TEST_HOST, TEST_PORT, options)

    server.route({
      method : 'GET',
      path : TEST_PATH,
      handler : function () {
        this.reply.view('index', {title : 'yo dawg'})
      }
    })

    agent.once('transactionFinished', function () {
      var stats = agent.metrics.getMetric('View/index/Rendering')
      t.equal(stats.callCount, 1, "should note the view rendering")
    })

    server.start(function cb_start() {
      request(TEST_URL, function (error, response, body) {
        if (error) t.fail(error)

        t.equal(response.statusCode, 200, "response code should be 200")
        t.equal(body, BODY, "template should still render fine")

        server.stop(function cb_stop() {
          helper.unloadAgent(agent)
          t.end()
        })
      })
    })
  })

  t.test("should generate rum headers",
       {timeout : 1000},
       function (t) {
    var agent  = helper.instrumentMockedAgent()
      , hapi   = require('hapi')
      , api    = new API(agent)
      

    agent.config.application_id = '12345'
    agent.config.browser_monitoring.browser_key = '12345'
    agent.config.browser_monitoring.js_agent_loader = 'function(){}'

    var options = {
      views : {
        path : path.join(__dirname, 'views'),
        engines : {
          ejs : 'ejs'
        }
      }
    }

    var server = hapi.createServer(TEST_HOST, TEST_PORT, options)

    server.route({
      method : 'GET',
      path : TEST_PATH,
      handler : function () {
        var rum = api.getBrowserTimingHeader()
        t.equal(rum.substr(0,7), '<script')
        this.reply.view('index', {title : 'yo dawg'})
      }
    })

    agent.once('transactionFinished', function () {
      var stats = agent.metrics.getMetric('View/index/Rendering')
      t.equal(stats.callCount, 1, "should note the view rendering")
    })

    server.start(function cb_start() {
      request(TEST_URL, function (error, response, body) {
        if (error) t.fail(error)

        t.equal(response.statusCode, 200, "response code should be 200")
        t.equal(body, BODY, "template should still render fine")

        server.stop(function cb_stop() {
          helper.unloadAgent(agent)
          t.end()
        })
      })
    })
  })

  t.test("should trap errors correctly", function (t) {
    var agent  = helper.instrumentMockedAgent()
      , hapi   = require('hapi')
      , server = hapi.createServer(TEST_HOST, TEST_PORT)
      

    server.route({
      method  : 'GET',
      path    : TEST_PATH,
      handler : function () {
        var hmm
        hmm.ohno.failure.is.terrible()
      }
    })

    server.start(function cb_start() {
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

        server.stop(function cb_stop() {
          helper.unloadAgent(agent)
          t.end()
        })
      })
    })
  })
})
