'use strict'

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require('../../lib/agent_helper.js')


test("Restify capture params introspection", function (t) {
  t.plan(4)

  t.test('simple case with no params', function (t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent()
      , server = require('restify').createServer()


    agent.config.capture_params = true

    this.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {}, 'parameters should be empty')
    })

    server.get('/test', function (req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(8089, function () {
      request.get('http://localhost:8089/test',
                  {json : true},
                  function (error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })

  t.test('case with route params', function (t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent()
      , server = require('restify').createServer()


    agent.config.capture_params = true

    this.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)

    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {id: '1337'},
                  'parameters should have id')
    })

    server.get('/test/:id', function (req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(8089, function () {
      request.get('http://localhost:8089/test/1337',
                  {json : true},
                  function (error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })

  t.test('case with query params', function (t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent()
      , server = require('restify').createServer()


    agent.config.capture_params = true

    this.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
     })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {name: 'restify'},
                  'parameters should have name')
    })

    server.get('/test', function (req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(8089, function () {
      request.get('http://localhost:8089/test?name=restify',
                  {json : true},
                  function (error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })

  t.test('case with both route and query params', function (t) {
    t.plan(5)

    var agent  = helper.instrumentMockedAgent()
      , server = require('restify').createServer()


    agent.config.capture_params = true

    this.tearDown(function () {
      server.close()
      helper.unloadAgent(agent)
    })

    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      t.deepEqual(transaction.trace.parameters, {id: '1337', name: 'restify'},
                  'parameters should have id and name')
    })

    server.get('/test/:id', function (req, res, next) {
      t.ok(agent.getTransaction(), "transaction is available")

      res.send({status : 'ok'})
      next()
    })

    server.listen(8089, function () {
      request.get('http://localhost:8089/test/1337?name=restify',
                  {json : true},
                  function (error, res, body) {
        t.equal(res.statusCode, 200, "nothing exploded")
        t.deepEqual(body, {status : 'ok'}, "got expected respose")
      })
    })
  })

})
