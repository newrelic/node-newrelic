/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: this only seems used by hapi-pre-17 now. confirm and move code directly in there.
// If used in multiple places but only versioned, move under versioned hapi folder.

const DESTINATIONS = require('../../../../lib/config/attribute-filter').DESTINATIONS
const helper = require('../../../lib/agent_helper')
const HTTP_ATTRS = require('../../../lib/fixtures').httpAttributes
const request = require('request')
const tap = require('tap')

module.exports = runTests

function runTests(createServer) {
  tap.test('Hapi capture params support', function (t) {
    t.autoend()

    let agent = null
    let server = null
    let port = null

    t.beforeEach(() => {
      agent = helper.instrumentMockedAgent({
        allow_all_headers: false,
        attributes: {
          enabled: true,
          include: ['request.parameters.*']
        }
      })

      server = createServer()
    })

    t.afterEach(async () => {
      helper.unloadAgent(agent)

      await new Promise((resolve, reject) => {
        server.stop((err) => {
          if (err) {
            return reject(err)
          }

          resolve()
        })
      })
    })

    t.test('simple case with no params', function (t) {
      agent.on('transactionFinished', function (transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        HTTP_ATTRS.forEach(function (key) {
          t.ok(attributes[key], 'Trace contains expected HTTP attribute: ' + key)
        })
        if (attributes.httpResponseMessage) {
          t.equal(attributes.httpResponseMessage, 'OK', 'Trace contains httpResponseMessage')
        }
      })

      server.route({
        method: 'GET',
        path: '/test/',
        handler: function (req, reply) {
          t.ok(agent.getTransaction(), 'transaction is available')

          reply({ status: 'ok' })
        }
      })

      server.start(function () {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/')
      })
    })

    t.test('case with route params', function (t) {
      agent.on('transactionFinished', function (transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        t.equal(
          attributes['request.parameters.id'],
          '1337',
          'Trace attributes include `id` route param'
        )
      })

      server.route({
        method: 'GET',
        path: '/test/{id}/',
        handler: function (req, reply) {
          t.ok(agent.getTransaction(), 'transaction is available')

          reply({ status: 'ok' })
        }
      })

      server.start(function () {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/1337/')
      })
    })

    t.test('case with query params', function (t) {
      agent.on('transactionFinished', function (transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        t.equal(
          attributes['request.parameters.name'],
          'hapi',
          'Trace attributes include `name` query param'
        )
      })

      server.route({
        method: 'GET',
        path: '/test/',
        handler: function (req, reply) {
          t.ok(agent.getTransaction(), 'transaction is available')

          reply({ status: 'ok' })
        }
      })

      server.start(function () {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/?name=hapi')
      })
    })

    t.test('case with both route and query params', function (t) {
      agent.on('transactionFinished', function (transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
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
        handler: function (req, reply) {
          t.ok(agent.getTransaction(), 'transaction is available')

          reply({ status: 'ok' })
        }
      })

      server.start(function () {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/1337/?name=hapi')
      })
    })
  })
}

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
