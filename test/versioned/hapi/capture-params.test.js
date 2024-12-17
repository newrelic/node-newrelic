/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const utils = require('./hapi-utils')

const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const HTTP_ATTS = require('../../lib/fixtures').httpAttributes

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    attributes: {
      enabled: true,
      include: ['request.parameters.*']
    }
  })

  ctx.nr.server = utils.getServer()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.stop()
})

function makeRequest(uri) {
  helper.makeGetRequest(uri, {}, function (_err, res, body) {
    assert.equal(res.statusCode, 200, 'nothing exploded')
    assert.deepStrictEqual(body, { status: 'ok' }, 'got expected response')
  })
}

test('simple case with no params', (t, end) => {
  const { agent, server } = t.nr

  agent.on('transactionFinished', function (transaction) {
    assert.ok(transaction.trace, 'transaction has a trace.')
    const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
    HTTP_ATTS.forEach(function (key) {
      assert.ok(attributes[key], 'Trace contains expected HTTP attribute: ' + key)
    })

    end()
  })

  server.route({
    method: 'GET',
    path: '/test/',
    handler: function () {
      assert.ok(agent.getTransaction(), 'transaction is available inside route handler')
      return { status: 'ok' }
    }
  })

  server.start().then(function () {
    const port = server.info.port
    makeRequest('http://localhost:' + port + '/test/')
  })
})

test('case with route params', (t, end) => {
  const { agent, server } = t.nr

  agent.on('transactionFinished', function (tx) {
    assert.ok(tx.trace, 'transaction has a trace.')
    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
    assert.equal(
      attributes['request.parameters.route.id'],
      '1337',
      'Trace attributes include `id` route param'
    )

    end()
  })

  server.route({
    method: 'GET',
    path: '/test/{id}/',
    handler: function () {
      assert.ok(agent.getTransaction(), 'transaction is available')
      return { status: 'ok' }
    }
  })

  server.start().then(function () {
    const port = server.info.port
    makeRequest('http://localhost:' + port + '/test/1337/')
  })
})

test('case with query params', (t, end) => {
  const { agent, server } = t.nr

  agent.on('transactionFinished', function (tx) {
    assert.ok(tx.trace, 'transaction has a trace.')
    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
    assert.equal(
      attributes['request.parameters.name'],
      'hapi',
      'Trace attributes include `name` query param'
    )

    end()
  })

  server.route({
    method: 'GET',
    path: '/test/',
    handler: function () {
      assert.ok(agent.getTransaction(), 'transaction is available')
      return { status: 'ok' }
    }
  })

  server.start().then(function () {
    const port = server.info.port
    makeRequest('http://localhost:' + port + '/test/?name=hapi')
  })
})

test('case with both route and query params', (t, end) => {
  const { agent, server } = t.nr

  agent.on('transactionFinished', function (tx) {
    assert.ok(tx.trace, 'transaction has a trace.')
    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
    assert.equal(
      attributes['request.parameters.route.id'],
      '1337',
      'Trace attributes include `id` route param'
    )
    assert.equal(
      attributes['request.parameters.name'],
      'hapi',
      'Trace attributes include `name` query param'
    )

    end()
  })

  server.route({
    method: 'GET',
    path: '/test/{id}/',
    handler: function () {
      assert.ok(agent.getTransaction(), 'transaction is available')
      return { status: 'ok' }
    }
  })

  server.start().then(function () {
    const port = server.info.port
    makeRequest('http://localhost:' + port + '/test/1337/?name=hapi')
  })
})
