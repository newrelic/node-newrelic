'use strict'

// shut up, Express
process.env.NODE_ENV = 'test'

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require('../../lib/agent_helper')
  , API     = require('../../../api.js')
  

// CONSTANTS
var TEST_PORT = 9876
  , TEST_HOST = 'localhost'
  , TEST_URL  = 'http://' + TEST_HOST + ':' + TEST_PORT
  


test("test capture_params for express", function (t) {
  t.test("no variables", function (t) {
    t.plan(5)
    var agent = helper.instrumentMockedAgent({express4: true})
      , app = require('express')()
      , server = require('http').createServer(app)
      

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

      res.send({yep : true})
      res.end()
    })

    agent.on('transactionFinished', function (transaction){
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {}, 'parameters should be empty')
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL + '/user/', function (error, response, body) {
        if (error) t.fail(error)

        t.ok(/application\/json/.test(response.headers['content-type']),
             "got correct content type")
        t.deepEqual(JSON.parse(body), {"yep":true}, "Express correctly serves.")
      })
    })
  })

  t.test("route variables", function (t) {
    t.plan(5)
    var agent = helper.instrumentMockedAgent({express4: true})
      , app = require('express')()
      , server = require('http').createServer(app)
      

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

      res.send({yep : true})
      res.end()
    })

    agent.on('transactionFinished', function (transaction){
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {id: 5},
                  'parameters should include route params')
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL + '/user/5', function (error, response, body) {
        if (error) t.fail(error)

        t.ok(/application\/json/.test(response.headers['content-type']),
             "got correct content type")
        t.deepEqual(JSON.parse(body), {"yep":true}, "Express correctly serves.")
      })
    })
  })

  t.test("query variables", {timeout : 1000}, function (t) {
    t.plan(5)
    var agent = helper.instrumentMockedAgent({express4: true})
      , app = require('express')()
      , server = require('http').createServer(app)
      

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

      res.send({yep : true})
      res.end()
    })

    agent.on('transactionFinished', function (transaction){
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {name: 'bob'},
                  'parameters should include query params')
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL + '/user/?name=bob', function (error, response, body) {
        if (error) t.fail(error)

        t.ok(/application\/json/.test(response.headers['content-type']),
             "got correct content type")
        t.deepEqual(JSON.parse(body), {"yep":true}, "Express correctly serves.")
      })
    })
  })

  t.test("route and query variables", function (t) {
    t.plan(5)
    var agent = helper.instrumentMockedAgent({express4: true})
      , app = require('express')()
      , server = require('http').createServer(app)
      

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

      res.send({yep : true})
      res.end()
    })

    agent.on('transactionFinished', function (transaction){
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {id: 5, name: 'bob'},
                  'parameters should include query params')
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL + '/user/5?name=bob', function (error, response, body) {
        if (error) t.fail(error)

        t.ok(/application\/json/.test(response.headers['content-type']),
             "got correct content type")
        t.deepEqual(JSON.parse(body), {"yep":true}, "Express correctly serves.")
      })
    })
  })

  t.test("query params mask route parameters", function (t) {
    var agent = helper.instrumentMockedAgent()
      , app = require('express')()
      , server = require('http').createServer(app)
      

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

    agent.on('transactionFinished', function (transaction){
      t.deepEqual(transaction.trace.parameters, {id: 6},
                  'parameters should include query params')
      t.end()
    })

    server.listen(TEST_PORT, TEST_HOST, function () {
      request.get(TEST_URL + '/user/5?id=6')
    })
  })

})
