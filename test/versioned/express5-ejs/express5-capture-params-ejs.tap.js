'use strict'

// shut up, Express
process.env.NODE_ENV = 'test'

var path = require('path')
var test = require('tap').test
var request = require('request')
var helper = require('../../lib/agent_helper')
var API = require('../../../api.js')


// CONSTANTS
var TEST_PORT = 9876
var TEST_HOST = 'localhost'
var TEST_URL = 'http://' + TEST_HOST + ':' + TEST_PORT


test("test capture_params for express", function (t) {
  t.test("no variables", function (t) {
    t.plan(5)
    var agent = helper.instrumentMockedAgent({express5: true})
    var app = require('express')()
    var server = require('http').createServer(app)

    this.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
    })

    // set apdexT so apdex stats will be recorded
    agent.config.apdex_t = 1

    // set capture_params so we get the data we need.
    agent.config.capture_params = true

    app.get('/user/', function (req, res) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({yep: true})
      res.end()
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      if (transaction.trace.parameters.httpResponseMessage) {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.host" : "localhost:9876",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "12",
          "response.headers.contentType" : "application/json; charset=utf-8"
        }, 'parameters should only have request/response params')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.host" : "localhost:9876",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "12",
          "response.headers.contentType" : "application/json; charset=utf-8"
        }, 'parameters should only have request/response params')
      }
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL + '/user/', function (error, response, body) {
        if (error) t.fail(error)

        t.ok(/application\/json/.test(response.headers['content-type']),
             "got correct content type")
        t.deepEqual(JSON.parse(body), {"yep": true}, "Express correctly serves.")
      })
    })
  })

  t.test("route variables", function (t) {
    t.plan(5)
    var agent = helper.instrumentMockedAgent({express5: true})
    var app = require('express')()
    var server = require('http').createServer(app)

    this.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
    })

    // set apdexT so apdex stats will be recorded
    agent.config.apdex_t = 1

    // set capture_params so we get the data we need.
    agent.config.capture_params = true

    app.get('/user/:id', function (req, res) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({yep: true})
      res.end()
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      if (transaction.trace.parameters.httpResponseMessage) {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.host" : "localhost:9876",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "12",
          "response.headers.contentType" : "application/json; charset=utf-8",
          "id" : "5"
        }, 'parameters should include route params')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.host" : "localhost:9876",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "12",
          "response.headers.contentType" : "application/json; charset=utf-8",
          "id" : "5"
        }, 'parameters should include route params')
      }
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL + '/user/5', function (error, response, body) {
        if (error) t.fail(error)

        t.ok(/application\/json/.test(response.headers['content-type']),
             "got correct content type")
        t.deepEqual(JSON.parse(body), {"yep": true}, "Express correctly serves.")
      })
    })
  })

  t.test("query variables", {timeout: 1000}, function (t) {
    t.plan(5)
    var agent = helper.instrumentMockedAgent({express5: true})
    var app = require('express')()
    var server = require('http').createServer(app)

    this.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
    })

    // set apdexT so apdex stats will be recorded
    agent.config.apdex_t = 1

    // set capture_params so we get the data we need.
    agent.config.capture_params = true

    app.get('/user/', function (req, res) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({yep: true})
      res.end()
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      if (transaction.trace.parameters.httpResponseMessage) {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.host" : "localhost:9876",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "12",
          "response.headers.contentType" : "application/json; charset=utf-8",
          "name" : "bob"
        }, 'parameters should include query params')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.host" : "localhost:9876",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "12",
          "response.headers.contentType" : "application/json; charset=utf-8",
          "name" : "bob"
        }, 'parameters should include query params')
      }
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL + '/user/?name=bob', function (error, response, body) {
        if (error) t.fail(error)

        t.ok(/application\/json/.test(response.headers['content-type']),
             "got correct content type")
        t.deepEqual(JSON.parse(body), {"yep": true}, "Express correctly serves.")
      })
    })
  })

  t.test("route and query variables", function (t) {
    t.plan(5)
    var agent = helper.instrumentMockedAgent({express5: true})
    var app = require('express')()
    var server = require('http').createServer(app)

    this.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
    })

    // set apdexT so apdex stats will be recorded
    agent.config.apdex_t = 1

    // set capture_params so we get the data we need.
    agent.config.capture_params = true

    app.get('/user/:id', function (req, res) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({yep: true})
      res.end()
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      if (transaction.trace.parameters.httpResponseMessage) {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.host" : "localhost:9876",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "httpResponseMessage": "OK",
          "response.headers.contentLength" : "12",
          "response.headers.contentType" : "application/json; charset=utf-8",
          "id" : "5",
          "name" : "bob"
        }, 'parameters should include query params')
      } else {
        t.deepEqual(transaction.trace.parameters, {
          "request.headers.host" : "localhost:9876",
          "request.method" : "GET",
          "response.status" : 200,
          "httpResponseCode": "200",
          "response.headers.contentLength" : "12",
          "response.headers.contentType" : "application/json; charset=utf-8",
          "id" : "5",
          "name" : "bob"
        }, 'parameters should include query params')
      }
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL + '/user/5?name=bob', function (error, response, body) {
        if (error) t.fail(error)

        t.ok(/application\/json/.test(response.headers['content-type']),
             "got correct content type")
        t.deepEqual(JSON.parse(body), {"yep": true}, "Express correctly serves.")
      })
    })
  })

  t.test("query params mask route parameters", function (t) {
    var agent = helper.instrumentMockedAgent({express5: true})
    var app = require('express')()
    var server = require('http').createServer(app)

    this.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
    })

    // set apdexT so apdex stats will be recorded
    agent.config.apdex_t = 1

    // set capture_params so we get the data we need.
    agent.config.capture_params = true

    app.get('/user/:id', function (req, res) {
      res.end()
    })

    agent.on('transactionFinished', function (transaction) {
      // on older versions of node response messages aren't included and
      // 0 content lengths aren't included
      var expectedValues = {
            "request.headers.host" : "localhost:9876",
            "request.method" : "GET",
            "response.status" : 200,
            "httpResponseCode": "200",
            "id" : 5
      }
      var possibleExpected = {
        "httpResponseMessage": "OK",
        "response.headers.contentLength": 0
      }
      var keys = ['response.headers.contentLength', 'httpResponseMessage']
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i]
        var value = transaction.trace.parameters[key]
        if (value !== undefined) {
          expectedValues[key] = possibleExpected[key]
        }
      }
      t.deepEqual(transaction.trace.parameters,
          expectedValues, 'parameters should include query params')
      t.end()
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL + '/user/5?id=6')
    })
  })

})
