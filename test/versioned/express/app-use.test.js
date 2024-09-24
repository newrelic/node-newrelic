/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const http = require('http')
const { isExpress5 } = require('./utils')
const tsplan = require('@matteo.collina/tspl')

// This test is no longer applicable in express 5 as mounting a child router does not emit the same
// mount event
test('app should be at top of stack when mounted', { skip: isExpress5() }, async function (t) {
  const agent = helper.instrumentMockedAgent()
  const express = require('express')

  t.after(() => {
    helper.unloadAgent(agent)
  })

  const plan = tsplan(t, { plan: 1 })

  const main = express()
  const child = express()

  child.on('mount', function () {
    plan.equal(main._router.stack.length, 3, '3 middleware functions: query parser, Express, child')
  })

  main.use(child)
  await plan.completed
})

test('app should be at top of stack when mounted', async function (t) {
  const agent = helper.instrumentMockedAgent()

  const express = require('express')
  const main = express()
  const app = express()
  const app2 = express()
  const router = new express.Router()
  const router2 = new express.Router()
  const server = http.createServer(main)

  t.after(function () {
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

  const plan = tsplan(t, { plan: 10 })

  // store finished transactions
  const finishedTransactions = {}
  agent.on('transactionFinished', function (tx) {
    finishedTransactions[tx.id] = tx
  })

  helper.randomPort(function (port) {
    server.listen(port, function () {
      const host = 'http://localhost:' + port
      helper.makeGetRequest(host + '/myApp/myChild/app', function (err, res, body) {
        plan.ok(!err)
        plan.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:app/:child/app',
          'should set partialName correctly for nested apps'
        )
      })

      helper.makeGetRequest(host + '/myApp/nestedApp  ', function (err, res, body) {
        plan.ok(!err)
        plan.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:app/nestedApp',
          'should set partialName correctly for deeply nested apps'
        )
      })

      helper.makeGetRequest(host + '/myApp/myChild/router', function (err, res, body) {
        plan.ok(!err)
        plan.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:router/:child/router',
          'should set partialName correctly for nested routers'
        )
      })

      helper.makeGetRequest(host + '/myApp/nestedRouter', function (err, res, body) {
        plan.ok(!err)
        plan.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:router/nestedRouter',
          'should set partialName correctly for deeply nested routers'
        )
      })

      helper.makeGetRequest(host + '/foo/bar', function (err, res, body) {
        plan.ok(!err)
        plan.equal(
          finishedTransactions[body].nameState.getName(),
          'Expressjs/GET//:foo/:bar',
          'should reset partialName after a router without a matching route'
        )
      })
    })
  })

  function respond(req, res) {
    const tx = agent.getTransaction()
    res.send(tx.id)
  }
  await plan.completed
})

test('should not pass wrong args when transaction is not present', async function (t) {
  const plan = tsplan(t, { plan: 5 })

  const agent = helper.instrumentMockedAgent()

  const express = require('express')
  const main = express()
  const router = new express.Router()
  const router2 = new express.Router()
  const server = http.createServer(main)
  let args

  main.use('/', router)
  main.use('/', router2)

  t.after(function () {
    helper.unloadAgent(agent)
    server.close()
  })

  router.get('/', function (req, res, next) {
    args = [req, res]
    agent.getTransaction().end()
    next()
  })

  router2.get('/', function (req, res, next) {
    plan.equal(req, args[0])
    plan.equal(res, args[1])
    plan.equal(typeof next, 'function')
    res.send('ok')
  })

  helper.randomPort(function (port) {
    server.listen(port, function () {
      helper.makeGetRequest('http://localhost:' + port + '/', function (err, res, body) {
        plan.ok(!err)
        plan.equal(body, 'ok')
      })
    })
  })
  await plan.completed
})
