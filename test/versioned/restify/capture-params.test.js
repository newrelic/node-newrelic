/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const helper = require('../../lib/agent_helper')
const HTTP_ATTS = require('../../lib/fixtures').httpAttributes

test('Restify capture params introspection', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      allow_all_headers: false,
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('simple case with no params', function (t, end) {
    const { agent } = t.nr
    const server = require('restify').createServer()
    let port = null

    t.after(function () {
      server.close()
    })

    agent.on('transactionFinished', function (transaction) {
      assert.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      HTTP_ATTS.forEach(function (key) {
        assert.ok(attributes[key], 'Trace contains expected HTTP attribute: ' + key)
      })
      if (attributes.httpResponseMessage) {
        assert.equal(attributes.httpResponseMessage, 'OK', 'Trace contains httpResponseMessage')
      }
    })

    server.get('/test', function (req, res, next) {
      assert.ok(agent.getTransaction(), 'transaction is available')

      res.send({ status: 'ok' })
      next()
    })

    server.listen(0, function () {
      port = server.address().port
      helper.makeGetRequest('http://localhost:' + port + '/test', function (error, res, body) {
        assert.equal(res.statusCode, 200, 'nothing exploded')
        assert.deepEqual(body, { status: 'ok' }, 'got expected response')
        end()
      })
    })
  })

  await t.test('case with route params', function (t, end) {
    const { agent } = t.nr
    const server = require('restify').createServer()
    let port = null

    t.after(function () {
      server.close()
    })

    agent.on('transactionFinished', function (transaction) {
      assert.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(
        attributes['request.parameters.route.id'],
        '1337',
        'Trace attributes include `id` route param'
      )
    })

    server.get('/test/:id', function (req, res, next) {
      assert.ok(agent.getTransaction(), 'transaction is available')

      res.send({ status: 'ok' })
      next()
    })

    server.listen(0, function () {
      port = server.address().port
      helper.makeGetRequest('http://localhost:' + port + '/test/1337', function (error, res, body) {
        assert.equal(res.statusCode, 200, 'nothing exploded')
        assert.deepEqual(body, { status: 'ok' }, 'got expected respose')
        end()
      })
    })
  })

  await t.test('case with query params', function (t, end) {
    const { agent } = t.nr
    const server = require('restify').createServer()
    let port = null

    t.after(function () {
      server.close()
    })

    agent.on('transactionFinished', function (transaction) {
      assert.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(
        attributes['request.parameters.name'],
        'restify',
        'Trace attributes include `name` query param'
      )
    })

    server.get('/test', function (req, res, next) {
      assert.ok(agent.getTransaction(), 'transaction is available')

      res.send({ status: 'ok' })
      next()
    })

    server.listen(0, function () {
      port = server.address().port
      const url = 'http://localhost:' + port + '/test?name=restify'
      helper.makeGetRequest(url, function (error, res, body) {
        assert.equal(res.statusCode, 200, 'nothing exploded')
        assert.deepEqual(body, { status: 'ok' }, 'got expected respose')
        end()
      })
    })
  })

  await t.test('case with both route and query params', function (t, end) {
    const { agent } = t.nr
    const server = require('restify').createServer()
    let port = null

    t.after(function () {
      server.close()
    })

    agent.on('transactionFinished', function (transaction) {
      assert.ok(transaction.trace, 'transaction has a trace.')
      // on older versions of node response messages aren't included
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(
        attributes['request.parameters.route.id'],
        '1337',
        'Trace attributes include `id` route param'
      )
      assert.equal(
        attributes['request.parameters.name'],
        'restify',
        'Trace attributes include `name` query param'
      )
    })

    server.get('/test/:id', function (req, res, next) {
      assert.ok(agent.getTransaction(), 'transaction is available')

      res.send({ status: 'ok' })
      next()
    })

    server.listen(0, function () {
      port = server.address().port
      const url = 'http://localhost:' + port + '/test/1337?name=restify'
      helper.makeGetRequest(url, function (error, res, body) {
        assert.equal(res.statusCode, 200, 'nothing exploded')
        assert.deepEqual(body, { status: 'ok' }, 'got expected respose')
        end()
      })
    })
  })
})
