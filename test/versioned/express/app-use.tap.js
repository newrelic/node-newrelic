/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')
const http = require('http')

test('app should be at top of stack when mounted', function (t) {
  const agent = helper.instrumentMockedAgent()
  const express = require('express')

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  t.plan(1)

  const main = express()
  const child = express()

  child.on('mount', function () {
    t.equal(main._router.stack.length, 3, '3 middleware functions: query parser, Express, child')
  })

  main.use(child)
})

test('app should be at top of stack when mounted', function (t) {
  const agent = helper.instrumentMockedAgent()

  const express = require('express')
  const main = express()
  const app = express()
  const app2 = express()
  const router = new express.Router()
  const router2 = new express.Router()
  const server = http.createServer(main)

  t.teardown(function () {
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
  const finishedTransactions = {}
  agent.on('transactionFinished', function (tx) {
    finishedTransactions[tx.id] = tx
  })

  helper.randomPort(function (port) {
    server.listen(port, function () {
      const host = 'http://localhost:' + port
      helper.makeGetRequest(host + '/myApp/myChild/app', function (err, res, body) {
        t.notOk(err)
        t.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:app/:child/app',
          'should set partialName correctly for nested apps'
        )
      })

      helper.makeGetRequest(host + '/myApp/nestedApp  ', function (err, res, body) {
        t.notOk(err)
        t.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:app/nestedApp',
          'should set partialName correctly for deeply nested apps'
        )
      })

      helper.makeGetRequest(host + '/myApp/myChild/router', function (err, res, body) {
        t.notOk(err)
        t.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:router/:child/router',
          'should set partialName correctly for nested routers'
        )
      })

      helper.makeGetRequest(host + '/myApp/nestedRouter', function (err, res, body) {
        t.notOk(err)
        t.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:router/nestedRouter',
          'should set partialName correctly for deeply nested routers'
        )
      })

      helper.makeGetRequest(host + '/foo/bar', function (err, res, body) {
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

test('should not pass wrong args when transaction is not present', function (t) {
  t.plan(5)

  const agent = helper.instrumentMockedAgent()

  const express = require('express')
  const main = express()
  const router = new express.Router()
  const router2 = new express.Router()
  const server = http.createServer(main)
  let args

  main.use('/', router)
  main.use('/', router2)

  t.teardown(function () {
    helper.unloadAgent(agent)
    server.close()
  })

  router.get('/', function (req, res, next) {
    args = [req, res]
    agent.getTransaction().end()
    next()
  })

  router2.get('/', function (req, res, next) {
    t.equal(req, args[0])
    t.equal(res, args[1])
    t.equal(typeof next, 'function')
    res.send('ok')
  })

  helper.randomPort(function (port) {
    server.listen(port, function () {
      helper.makeGetRequest('http://localhost:' + port + '/', function (err, res, body) {
        t.notOk(err)
        t.equal(body, 'ok')
        t.end()
      })
    })
  })
})
