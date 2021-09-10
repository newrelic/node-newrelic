/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DESTINATIONS = require('../../../../lib/config/attribute-filter').DESTINATIONS
const tap = require('tap')
const request = require('request')
const helper = require('../../../lib/agent_helper')
const utils = require('./hapi-17-utils')
const HTTP_ATTS = require('../../../lib/fixtures').httpAttributes

tap.test('Hapi capture params support', function (t) {
  t.autoend()

  let agent = null
  let server = null
  let port = null

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })

    server = utils.getServer()

    agent.config.attributes.enabled = true
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    return server.stop()
  })

  t.test('simple case with no params', function (t) {
    agent.on('transactionFinished', function (transaction) {
      t.ok(transaction.trace, 'transaction has a trace.')
      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      HTTP_ATTS.forEach(function (key) {
        t.ok(attributes[key], 'Trace contains expected HTTP attribute: ' + key)
      })
    })

    server.route({
      method: 'GET',
      path: '/test/',
      handler: function () {
        t.ok(agent.getTransaction(), 'transaction is available inside route handler')
        return { status: 'ok' }
      }
    })

    server.start().then(function () {
      port = server.info.port
      makeRequest(t, 'http://localhost:' + port + '/test/')
    })
  })

  t.test('case with route params', function (t) {
    agent.on('transactionFinished', function (tx) {
      t.ok(tx.trace, 'transaction has a trace.')
      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      t.equal(
        attributes['request.parameters.id'],
        '1337',
        'Trace attributes include `id` route param'
      )
    })

    server.route({
      method: 'GET',
      path: '/test/{id}/',
      handler: function () {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function () {
      port = server.info.port
      makeRequest(t, 'http://localhost:' + port + '/test/1337/')
    })
  })

  t.test('case with query params', function (t) {
    agent.on('transactionFinished', function (tx) {
      t.ok(tx.trace, 'transaction has a trace.')
      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      t.equal(
        attributes['request.parameters.name'],
        'hapi',
        'Trace attributes include `name` query param'
      )
    })

    server.route({
      method: 'GET',
      path: '/test/',
      handler: function () {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function () {
      port = server.info.port
      makeRequest(t, 'http://localhost:' + port + '/test/?name=hapi')
    })
  })

  t.test('case with both route and query params', function (t) {
    agent.on('transactionFinished', function (tx) {
      t.ok(tx.trace, 'transaction has a trace.')
      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      t.equal(
        attributes['request.parameters.id'],
        '1337',
        'Trace attributes include `id` route param'
      )
      t.equal(
        attributes['request.parameters.name'],
        'hapi',
        'Trace attributes include `name` query param'
      )
    })

    server.route({
      method: 'GET',
      path: '/test/{id}/',
      handler: function () {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function () {
      port = server.info.port
      makeRequest(t, 'http://localhost:' + port + '/test/1337/?name=hapi')
    })
  })
})

function makeRequest(t, uri) {
  const params = {
    uri: uri,
    json: true
  }
  request.get(params, function (err, res, body) {
    t.equal(res.statusCode, 200, 'nothing exploded')
    t.deepEqual(body, { status: 'ok' }, 'got expected response')
    t.end()
  })
}
