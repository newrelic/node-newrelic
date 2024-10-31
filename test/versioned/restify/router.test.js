/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const helper = require('../../lib/agent_helper')
const { version: pkgVersion } = require('restify/package')
const semver = require('semver')

test('Restify router', async function (t) {
  t.beforeEach(function (ctx) {
    const agent = helper.instrumentMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })

    const server = require('restify').createServer()
    ctx.nr = {
      agent,
      server
    }
  })

  t.afterEach(function (ctx) {
    const { agent, server } = ctx.nr
    return new Promise((resolve) => {
      server.close(function () {
        helper.unloadAgent(agent)
        resolve()
      })
    })
  })

  await t.test('introspection', async function (t) {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 12 })

    // need to capture attributes
    agent.config.attributes.enabled = true

    agent.on('transactionFinished', function (transaction) {
      plan.equal(
        transaction.name,
        'WebTransaction/Restify/GET//test/:id',
        'transaction has expected name'
      )
      plan.equal(transaction.url, '/test/31337', 'URL is left alone')
      plan.equal(transaction.statusCode, 200, 'status code is OK')
      plan.equal(transaction.verb, 'GET', 'HTTP method is GET')
      plan.ok(transaction.trace, 'transaction has trace')

      const [web] = transaction.trace.getChildren(transaction.trace.root.id)
      plan.ok(web, 'trace has web segment')
      plan.equal(web.name, transaction.name, 'segment name and transaction name match')
      plan.equal(web.partialName, 'Restify/GET//test/:id', 'should have partial name for apdex')
      plan.equal(
        web.getAttributes()['request.parameters.route.id'],
        '31337',
        'namer gets parameters out of route'
      )
    })

    server.get('/test/:id', function (req, res, next) {
      plan.ok(agent.getTransaction(), 'transaction should be available')

      res.send({ status: 'ok' })
      next()
    })

    _listenAndRequest({ server, plan, route: '/test/31337' })
    await plan.completed
  })

  await t.test('trailing slash differentiates routes (without slash)', async function (t) {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 3 })

    server.get('/path1/', function first(req, res, next) {
      plan.ok(0, 'should not enter this route')
      res.send({ status: 'ok' })
      next()
    })
    server.get('/path1', function first(req, res, next) {
      plan.ok(agent.getTransaction(), 'should enter this route')
      res.send({ status: 'ok' })
      next()
    })

    _listenAndRequest({ server, plan, route: '/path1' })
    await plan.completed
  })

  await t.test('trailing slash differentiates routes (with slash)', async function (t) {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 3 })

    server.get('/path1/', function first(req, res, next) {
      plan.ok(agent.getTransaction(), 'should enter this route')
      res.send({ status: 'ok' })
      next()
    })
    server.get('/path1', function first(req, res, next) {
      plan.ok(0, 'should not enter this route')
      res.send({ status: 'ok' })
      next()
    })

    _listenAndRequest({ server, plan, route: '/path1/' })
    await plan.completed
  })

  // added ignoreTrailingSlash is 7.1.0
  // https://github.com/restify/node-restify/blob/master/CHANGELOG.md#710-2018-03-26
  if (semver.satisfies(pkgVersion, '>=7.1.0')) {
    await t.test('ignoreTrailingSlash option should ignore trailing slash', async function (t) {
      const { agent } = t.nr
      const plan = tspl(t, { plan: 3 })

      const server = require('restify').createServer({ ignoreTrailingSlash: true })

      t.after(() => {
        server.close()
      })

      server.get('/path1/', function first(req, res, next) {
        plan.ok(agent.getTransaction(), 'should enter this route')
        res.send({ status: 'ok' })
        next()
      })

      _listenAndRequest({ server, plan, route: '/path1' })
      await plan.completed
    })
  }

  // fixed in 7.2.3
  // https://github.com/restify/node-restify/blob/master/CHANGELOG.md#723-2018-11-16
  if (semver.satisfies(pkgVersion, '>=7.2.3')) {
    await t.test('next(true): terminates processing', async function (t) {
      const { agent, server } = t.nr
      const plan = tspl(t, { plan: 4 })

      server.get(
        '/test/:id',
        function first(req, res, next) {
          plan.ok(agent.getTransaction(), 'transaction should be available')
          res.send({ status: 'ok' })
          next(true)
        },
        function second(req, res, next) {
          plan.ok(0, 'should not enter this final middleware ')
          next(new Error('request should not have make it here'))
        }
      )

      agent.on('transactionFinished', function (tx) {
        plan.equal(tx.name, 'WebTransaction/Restify/GET//test/:id', 'should have correct name')
      })

      _listenAndRequest({ server, plan, route: '/test/foobar' })
      await plan.completed
    })
  }

  await t.test('next(false): stop processing', async function (t) {
    const { agent, server } = t.nr
    const plan = tspl(t, { plan: 4 })

    server.get(
      '/test/:id',
      function first(req, res, next) {
        plan.ok(agent.getTransaction(), 'transaction should be available')
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
      plan.equal(tx.name, 'WebTransaction/Restify/GET//test/:id', 'should have correct name')
    })

    _listenAndRequest({ server, plan, route: '/test/foobar' })
    await plan.completed
  })

  // This functionality is no longer supported in 9.0.0 https://github.com/restify/node-restify/pull/1847
  if (semver.satisfies(pkgVersion, '< 9')) {
    await t.test('next("other_route"): jump processing', async function (t) {
      const { agent, server } = t.nr
      const plan = tspl(t, { plan: 5 })

      server.get({ name: 'first', path: '/test/:id' }, function final(req, res, next) {
        plan.ok(agent.getTransaction(), 'transaction should be available')
        next('second')
      })

      server.get({ name: 'second', path: '/other' }, function final(req, res, next) {
        plan.ok(agent.getTransaction(), 'transaction should be available')
        res.send({ status: 'ok' })
        next()
      })

      agent.on('transactionFinished', function (tx) {
        plan.equal(tx.name, 'WebTransaction/Restify/GET//other', 'should have correct name')
      })

      _listenAndRequest({ server, plan, route: '/test/foobar' })
      await plan.completed
    })
  }

  function _listenAndRequest({ server, plan, route }) {
    server.listen(0, function () {
      const port = server.address().port
      const url = 'http://localhost:' + port + route
      helper.makeGetRequest(url, function (error, res, body) {
        plan.equal(res.statusCode, 200, 'nothing exploded')
        plan.deepEqual(body, { status: 'ok' }, 'got expected response')
      })
    })
  }
})
