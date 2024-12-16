/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const utils = require('./hapi-utils')

const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
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

test('should not explode when using vhosts', (t, end) => {
  const { agent, server } = t.nr

  agent.on('transactionFinished', (tx) => {
    assert.ok(tx.trace, 'transaction has a trace.')
    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
    HTTP_ATTS.forEach(function (key) {
      assert.ok(attributes[key], 'Trace contains expected HTTP attribute: ' + key)
    })
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

    helper.unloadAgent(agent)
  })

  server.route({
    method: 'GET',
    path: '/test/{id}/',
    vhost: 'localhost',
    handler: function () {
      assert.ok(agent.getTransaction(), 'transaction is available')
      return { status: 'ok' }
    }
  })

  server.route({
    method: 'GET',
    path: '/test/{id}/2',
    vhost: 'localhost',
    handler: function () {
      assert.ok(agent.getTransaction(), 'transaction is available')
      return { status: 'ok' }
    }
  })

  server.start().then(function () {
    const port = server.info.port
    const uri = 'http://localhost:' + port + '/test/1337/2?name=hapi'
    helper.makeRequest(uri, {}, function (_error, res, body) {
      assert.equal(res.statusCode, 200, 'nothing exploded')
      assert.deepStrictEqual(body, { status: 'ok' }, 'got expected response')
      end()
    })
  })
})
