/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../../lib/agent_helper')

tap.test('Restify router', function (t) {
  t.autoend()

  let agent = null
  let server = null

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })

    server = require('restify').createServer()
  })

  t.afterEach(function () {
    return new Promise((resolve) => {
      server.close(function () {
        helper.unloadAgent(agent)
        resolve()
      })
    })
  })

  t.test('introspection', function (t) {
    t.plan(12)

    // need to capture attributes
    agent.config.attributes.enabled = true

    agent.on('transactionFinished', function (transaction) {
      t.equal(
        transaction.name,
        'WebTransaction/Restify/GET//test/:id',
        'transaction has expected name'
      )
      t.equal(transaction.url, '/test/31337', 'URL is left alone')
      t.equal(transaction.statusCode, 200, 'status code is OK')
      t.equal(transaction.verb, 'GET', 'HTTP method is GET')
      t.ok(transaction.trace, 'transaction has trace')

      const web = transaction.trace.root.children[0]
      t.ok(web, 'trace has web segment')
      t.equal(web.name, transaction.name, 'segment name and transaction name match')
      t.equal(web.partialName, 'Restify/GET//test/:id', 'should have partial name for apdex')
      t.equal(
        web.getAttributes()['request.parameters.route.id'],
        '31337',
        'namer gets parameters out of route'
      )
    })

    server.get('/test/:id', function (req, res, next) {
      t.ok(agent.getTransaction(), 'transaction should be available')

      res.send({ status: 'ok' })
      next()
    })

    _listenAndRequest(t, '/test/31337')
  })

  t.test('next(true): continue processing', function (t) {
    t.plan(6)

    server.get(
      '/test/:id',
      function first(req, res, next) {
        t.ok(agent.getTransaction(), 'transaction should be available')
        next(true)
      },
      function second(req, res, next) {
        t.ok(agent.getTransaction(), 'transaction should be available')
        next(true)
      },
      function final(req, res, next) {
        t.ok(agent.getTransaction(), 'transaction should be available')
        res.send({ status: 'ok' })
        next()
      }
    )

    agent.on('transactionFinished', function (tx) {
      t.equal(tx.name, 'WebTransaction/Restify/GET//test/:id', 'should have correct name')
    })

    _listenAndRequest(t, '/test/foobar')
  })

  t.test('next(false): stop processing', function (t) {
    t.plan(4)

    server.get(
      '/test/:id',
      function first(req, res, next) {
        t.ok(agent.getTransaction(), 'transaction should be available')
        res.send({ status: 'ok' })
        next(false)
      },
      function final(req, res, next) {
        t.fail('should not enter this final middleware')
        res.send({ status: 'ok' })
        next()
      }
    )

    agent.on('transactionFinished', function (tx) {
      t.equal(tx.name, 'WebTransaction/Restify/GET//test/:id', 'should have correct name')
    })

    _listenAndRequest(t, '/test/foobar')
  })

  t.test('next("other_route"): jump processing', function (t) {
    t.plan(5)

    server.get({ name: 'first', path: '/test/:id' }, function final(req, res, next) {
      t.ok(agent.getTransaction(), 'transaction should be available')
      next('second')
    })

    server.get({ name: 'second', path: '/other' }, function final(req, res, next) {
      t.ok(agent.getTransaction(), 'transaction should be available')
      res.send({ status: 'ok' })
      next()
    })

    agent.on('transactionFinished', function (tx) {
      t.equal(tx.name, 'WebTransaction/Restify/GET//other', 'should have correct name')
    })

    _listenAndRequest(t, '/test/foobar')
  })

  function _listenAndRequest(t, route) {
    server.listen(0, function () {
      const port = server.address().port
      const url = 'http://localhost:' + port + route
      helper.makeGetRequest(url, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.same(body, { status: 'ok' }, 'got expected respose')
      })
    })
  }
})
