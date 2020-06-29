/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var test = require('tap').test
var helper  = require('../../lib/agent_helper')
var http = require('http')


test('app should be at top of stack when mounted', function(t) {
  var agent = helper.instrumentMockedAgent()
  var express = require('express')

  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })

  t.plan(1)

  var main = express()
  var child = express()

  child.on('mount', function() {
    t.equal(
      main._router.stack.length,
      3,
      '3 middleware functions: query parser, Express, child'
    )
  })

  main.use(child)
})

test('app should be at top of stack when mounted', function(t) {
  const agent = helper.instrumentMockedAgent()

  var express = require('express')
  var main = express()
  var app = express()
  var app2 = express()
  var router = new express.Router()
  var router2 = new express.Router()
  var server = http.createServer(main)

  t.tearDown(function() {
    helper.unloadAgent(agent)
    server.close()
  })

  main.use('/:app', app)
  main.use('/:router', router)
  app.use('/nestedApp', app2)
  router.use('/nestedRouter', router2)
  app.get('/:child/app', respond)
  app2.get('/', respond)
  router.get('/:child/router', respond)
  router2.get('/', respond)
  main.get('/:foo/:bar', respond)

  t.plan(10)

  // store finished transactions
  var finishedTransactions = {}
  agent.on('transactionFinished', function(tx) {
    finishedTransactions[tx.id] = tx
  })

  helper.randomPort(function(port) {
    server.listen(port, function() {
      var host = 'http://localhost:' + port
      helper.makeGetRequest(host + '/myApp/myChild/app', function(err, res, body) {
        t.notOk(err)
        t.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:app/:child/app',
          'should set partialName correctly for nested apps'
        )
      })

      helper.makeGetRequest(host + '/myApp/nestedApp  ', function(err, res, body) {
        t.notOk(err)
        t.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:app/nestedApp',
          'should set partialName correctly for deeply nested apps'
        )
      })

      helper.makeGetRequest(host + '/myApp/myChild/router', function(err, res, body) {
        t.notOk(err)
        t.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:router/:child/router',
          'should set partialName correctly for nested routers'
        )
      })

      helper.makeGetRequest(host + '/myApp/nestedRouter', function(err, res, body) {
        t.notOk(err)
        t.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:router/nestedRouter',
          'should set partialName correctly for deeply nested routers'
        )
      })

      helper.makeGetRequest(host + '/foo/bar', function(err, res, body) {
        t.notOk(err)
        t.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:foo/:bar',
          'should reset partialName after a router without a matching route'
        )
      })
    })
  })

  function respond(req, res) {
    res.send(agent.getTransaction().id)
  }
})

test('should not pass wrong args when transaction is not present', function(t) {
  t.plan(5)

  const agent = helper.instrumentMockedAgent()

  var express = require('express')
  var main = express()
  var router = new express.Router()
  var router2 = new express.Router()
  var server = http.createServer(main)
  var args

  main.use('/', router)
  main.use('/', router2)

  t.tearDown(function() {
    helper.unloadAgent(agent)
    server.close()
  })

  router.get('/', function(req, res, next) {
    args = [req, res]
    agent.getTransaction().end()
    next()
  })

  router2.get('/', function(req, res, next) {
    t.equal(req, args[0])
    t.equal(res, args[1])
    t.equal(typeof next, 'function')
    res.send('ok')
  })

  helper.randomPort(function(port) {
    server.listen(port, function() {
      helper.makeGetRequest('http://localhost:' + port + '/', function(err, res, body) {
        t.notOk(err)
        t.equal(body, 'ok')
        t.end()
      })
    })
  })
})
