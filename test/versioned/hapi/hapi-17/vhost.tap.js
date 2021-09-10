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

tap.test('Hapi vhost support', function (t) {
  t.autoend()

  t.test('should not explode when using vhosts', function (t) {
    const agent = helper.instrumentMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })

    const server = utils.getServer()
    let port

    t.teardown(function () {
      return server.stop()
    })

    agent.on('transactionFinished', function (tx) {
      t.ok(tx.trace, 'transaction has a trace.')
      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      HTTP_ATTS.forEach(function (key) {
        t.ok(attributes[key], 'Trace contains expected HTTP attribute: ' + key)
      })
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

      helper.unloadAgent(agent)
    })

    server.route({
      method: 'GET',
      path: '/test/{id}/',
      vhost: 'localhost',
      handler: function () {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.route({
      method: 'GET',
      path: '/test/{id}/2',
      vhost: 'localhost',
      handler: function () {
        t.ok(agent.getTransaction(), 'transaction is available')
        return { status: 'ok' }
      }
    })

    server.start().then(function () {
      port = server.info.port
      const params = {
        uri: 'http://localhost:' + port + '/test/1337/2?name=hapi',
        json: true
      }
      request.get(params, function (error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, { status: 'ok' }, 'got expected response')
        t.end()
      })
    })
  })
})
