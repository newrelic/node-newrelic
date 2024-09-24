/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// shut up, Express
process.env.NODE_ENV = 'test'
const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const HTTP_ATTS = require('../../lib/fixtures').httpAttributes
const { setup, teardown, TEST_URL } = require('./utils')

test('test attributes.enabled for express', async function (t) {
  t.beforeEach(async function (ctx) {
    await setup(ctx, {
      apdex_t: 1,
      allow_all_headers: false,
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })
  })

  t.afterEach(teardown)

  await t.test('no variables', function (t, end) {
    const { agent, app, port } = t.nr
    app.get('/user/', function (req, res) {
      assert.ok(agent.getTransaction(), 'transaction is available')

      res.send({ yep: true })
      res.end()
    })

    agent.on('transactionFinished', function (transaction) {
      assert.ok(transaction.trace, 'transaction has a trace.')
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      HTTP_ATTS.forEach(function (key) {
        assert.ok(attributes[key], 'Trace contains expected HTTP attribute: ' + key)
      })
      if (attributes.httpResponseMessage) {
        assert.equal(attributes.httpResponseMessage, 'OK', 'Trace contains httpResponseMessage')
      }
    })

    const url = `${TEST_URL}:${port}/user/`
    helper.makeGetRequest(url, function (error, response, body) {
      assert.ok(!error)
      assert.ok(
        /application\/json/.test(response.headers['content-type']),
        'got correct content type'
      )

      assert.deepEqual(body, { yep: true }, 'Express correctly serves.')
      end()
    })
  })

  await t.test('route variables', function (t, end) {
    const { agent, app, port } = t.nr

    app.get('/user/:id', function (req, res) {
      assert.ok(agent.getTransaction(), 'transaction is available')

      res.send({ yep: true })
      res.end()
    })

    agent.on('transactionFinished', function (transaction) {
      assert.ok(transaction.trace, 'transaction has a trace.')
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(
        attributes['request.parameters.route.id'],
        '5',
        'Trace attributes include `id` route param'
      )
    })

    const url = `${TEST_URL}:${port}/user/5`
    helper.makeGetRequest(url, function (error, response, body) {
      assert.ok(!error)
      assert.ok(
        /application\/json/.test(response.headers['content-type']),
        'got correct content type'
      )

      assert.deepEqual(body, { yep: true }, 'Express correctly serves.')
      end()
    })
  })

  await t.test('query variables', { timeout: 1000 }, function (t, end) {
    const { agent, app, port } = t.nr

    app.get('/user/', function (req, res) {
      assert.ok(agent.getTransaction(), 'transaction is available')

      res.send({ yep: true })
      res.end()
    })

    agent.on('transactionFinished', function (transaction) {
      assert.ok(transaction.trace, 'transaction has a trace.')
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(
        attributes['request.parameters.name'],
        'bob',
        'Trace attributes include `name` query param'
      )
    })

    const url = `${TEST_URL}:${port}/user/?name=bob`
    helper.makeGetRequest(url, function (error, response, body) {
      assert.ok(!error)
      assert.ok(
        /application\/json/.test(response.headers['content-type']),
        'got correct content type'
      )

      assert.deepEqual(body, { yep: true }, 'Express correctly serves.')
      end()
    })
  })

  await t.test('route and query variables', function (t, end) {
    const { agent, app, port } = t.nr

    app.get('/user/:id', function (req, res) {
      assert.ok(agent.getTransaction(), 'transaction is available')

      res.send({ yep: true })
      res.end()
    })

    agent.on('transactionFinished', function (transaction) {
      assert.ok(transaction.trace, 'transaction has a trace.')
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(
        attributes['request.parameters.route.id'],
        '5',
        'Trace attributes include `id` route param'
      )
      assert.equal(
        attributes['request.parameters.name'],
        'bob',
        'Trace attributes include `name` query param'
      )
    })

    const url = `${TEST_URL}:${port}/user/5?name=bob`
    helper.makeGetRequest(url, function (error, response, body) {
      assert.ok(!error)
      assert.ok(
        /application\/json/.test(response.headers['content-type']),
        'got correct content type'
      )

      assert.deepEqual(body, { yep: true }, 'Express correctly serves.')
      end()
    })
  })

  await t.test('query params should not mask route attributes', function (t, end) {
    const { agent, app, port } = t.nr

    app.get('/user/:id', function (req, res) {
      res.end()
    })

    agent.on('transactionFinished', function (transaction) {
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(
        attributes['request.parameters.route.id'],
        '5',
        'attributes should include route params'
      )
      assert.equal(
        attributes['request.parameters.id'],
        '6',
        'attributes should include query params'
      )
      end()
    })

    const url = `${TEST_URL}:${port}/user/5?id=6`
    helper.makeGetRequest(url)
  })
})
