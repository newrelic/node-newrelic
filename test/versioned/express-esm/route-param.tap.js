/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')
const request = require('request').defaults({ json: true })

test('Express route param', function (t) {
  const agent = helper.instrumentMockedAgent()
  const express = require('express')
  const server = createServer(express)

  t.teardown(function () {
    server.close(function () {
      helper.unloadAgent(agent)
    })
  })

  server.listen(0, function () {
    t.autoend()
    const port = server.address().port

    t.test('pass-through param', function (t) {
      t.plan(4)

      agent.once('transactionFinished', function (tx) {
        t.equal(
          tx.name,
          'WebTransaction/Expressjs/GET//a/b/:action/c',
          'should have correct transaction name'
        )
      })

      testRequest(port, 'foo', function (err, body) {
        t.notOk(err, 'should not have errored')
        t.equal(body.action, 'foo', 'should pass through correct parameter value')
        t.equal(body.name, 'action', 'should pass through correct parameter name')
      })
    })

    t.test('respond from param', function (t) {
      t.plan(3)

      agent.once('transactionFinished', function (tx) {
        t.equal(
          tx.name,
          'WebTransaction/Expressjs/GET//a/[param handler :action]',
          'should have correct transaction name'
        )
      })

      testRequest(port, 'deny', function (err, body) {
        t.notOk(err, 'should not have errored')
        t.equal(body, 'denied', 'should have responded from within paramware')
      })
    })

    t.test('in-active transaction in param handler', function (t) {
      t.plan(4)

      agent.once('transactionFinished', function (tx) {
        t.equal(
          tx.name,
          'WebTransaction/Expressjs/GET//a/b/preempt/c',
          'should have correct transaction name'
        )
      })

      testRequest(port, 'preempt', function (err, body) {
        t.notOk(err, 'should not have errored')
        t.equal(body.action, 'preempt', 'should pass through correct parameter value')
        t.equal(body.name, 'action', 'should pass through correct parameter name')
      })
    })
  })
})

function testRequest(port, param, cb) {
  const url = 'http://localhost:' + port + '/a/b/' + param + '/c'
  request.get(url, function (err, response, body) {
    cb(err, body)
  })
}

function createServer(express) {
  const app = express()

  const aRouter = new express.Router()
  const bRouter = new express.Router()
  const cRouter = new express.Router()

  cRouter.get('', function (req, res) {
    if (req.action !== 'preempt') {
      res.json({ action: req.action, name: req.name })
    }
  })

  bRouter.use('/c', cRouter)

  aRouter.param('action', function (req, res, next, action, name) {
    req.action = action
    req.name = name
    if (action === 'deny') {
      res.status(200).json('denied')
    } else {
      next()
    }
  })

  aRouter.use('/b/:action', bRouter)
  app.use('/a/b/preempt/c', function (req, res, next) {
    res.send({ action: 'preempt', name: 'action' })
    process.nextTick(next)
  })
  app.use('/a', aRouter)

  return require('http').createServer(app)
}
