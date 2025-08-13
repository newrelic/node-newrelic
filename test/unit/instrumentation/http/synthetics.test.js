/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../../lib/agent_helper')
const {
  SYNTHETICS_DATA,
  SYNTHETICS_INFO,
  SYNTHETICS_HEADER,
  SYNTHETICS_INFO_HEADER,
  ENCODING_KEY
} = require('../../../helpers/synthetics')

test('synthetics outbound header', async (t) => {
  const CONNECT_PARAMS = {
    hostname: 'localhost'
  }

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      cross_application_tracer: { enabled: true },
      trusted_account_ids: [23, 567],
      encoding_key: ENCODING_KEY
    })
    ctx.nr.http = require('http')
    const server = ctx.nr.http.createServer(function (req, res) {
      req.resume()
      res.end()
    })
    ctx.nr.server = server

    return new Promise((resolve) => {
      server.listen(0, function () {
        const { port } = this.address()
        ctx.nr.port = port
        resolve()
      })
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    return new Promise((resolve) => {
      ctx.nr.server.close(resolve)
    })
  })

  await t.test('should be propagated if on tx', (t, end) => {
    const { agent, http, port } = t.nr
    helper.runInTransaction(agent, 'web', function (transaction) {
      transaction.syntheticsData = SYNTHETICS_DATA
      transaction.syntheticsHeader = SYNTHETICS_HEADER
      transaction.syntheticsInfoData = SYNTHETICS_INFO
      transaction.syntheticsInfoHeader = SYNTHETICS_INFO_HEADER
      CONNECT_PARAMS.port = port
      const req = http.request(CONNECT_PARAMS, function (res) {
        res.resume()
        transaction.end()
        assert.equal(res.headers['x-newrelic-synthetics'], SYNTHETICS_HEADER)
        assert.equal(res.headers['x-newrelic-synthetics-info'], SYNTHETICS_INFO_HEADER)
        end()
      })
      const headers = req.getHeaders()
      assert.equal(headers['x-newrelic-synthetics'], SYNTHETICS_HEADER)
      assert.equal(headers['x-newrelic-synthetics-info'], SYNTHETICS_INFO_HEADER)
      req.end()
    })
  })

  await t.test('should not be propagated if not on tx', (t, end) => {
    const { agent, http, port } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      CONNECT_PARAMS.port = port
      http.get(CONNECT_PARAMS, function (res) {
        res.resume()
        transaction.end()
        assert.ok(!res.headers['x-newrelic-synthetics'])
        assert.ok(!res.headers['x-newrelic-synthetics-info'])
        end()
      })
    })
  })
})

test('should add synthetics inbound header to transaction', async (t) => {
  function createServer(cb, requestHandler) {
    const http = require('http')
    const s = http.createServer(function (req, res) {
      requestHandler(req, res)
      res.end()
      req.resume()
    })
    s.listen(0, cb)
    return s
  }

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      cross_application_tracer: { enabled: true },
      distributed_tracing: { enabled: false },
      trusted_account_ids: [23, 567],
      encoding_key: ENCODING_KEY
    })

    ctx.nr.http = require('http')
    const CONNECT_PARAMS = {
      hostname: 'localhost'
    }

    ctx.nr.options = Object.assign({}, CONNECT_PARAMS)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    return new Promise((resolve) => {
      ctx.nr.server.close(resolve)
    })
  })

  await t.test('should exist if account id and version are ok', (t, end) => {
    const { agent, http, options } = t.nr
    options.headers = {
      'X-NewRelic-Synthetics': SYNTHETICS_HEADER,
      'X-NewRelic-Synthetics-Info': SYNTHETICS_INFO_HEADER
    }
    t.nr.server = createServer(
      function onListen() {
        options.port = this.address().port
        http.get(options, function (res) {
          res.resume()
        })
      },
      function onRequest() {
        const tx = agent.getTransaction()
        assert.ok(tx)
        assert.equal(tx.syntheticsHeader, SYNTHETICS_HEADER)
        assert.equal(tx.syntheticsInfoHeader, SYNTHETICS_INFO_HEADER)
        assert.equal(typeof tx.syntheticsData, 'object')
        assert.deepEqual(tx.syntheticsData, SYNTHETICS_DATA)
        assert.deepEqual(tx.syntheticsInfoData, SYNTHETICS_INFO)
        end()
      }
    )
  })

  await t.test('should not exist if account id and version are not ok', (t, end) => {
    const { agent, http, options } = t.nr
    options.headers = {
      'X-NewRelic-Synthetics': 'bsstuff',
      'X-NewRelic-Synthetics-Info': 'noinfo'
    }
    t.nr.server = createServer(
      function onListen() {
        options.port = this.address().port
        http.get(options, function (res) {
          res.resume()
        })
      },
      function onRequest() {
        const tx = agent.getTransaction()
        assert.ok(tx)
        assert.ok(!tx.syntheticsHeader)
        assert.ok(!tx.syntheticsInfoHeader)
        end()
      }
    )
  })

  await t.test('should propagate inbound synthetics header on response', (t, end) => {
    const { http, options } = t.nr
    options.headers = {
      'X-NewRelic-Synthetics': SYNTHETICS_HEADER,
      'X-NewRelic-Synthetics-Info': SYNTHETICS_INFO_HEADER
    }
    t.nr.server = createServer(
      function onListen() {
        options.port = this.address().port
        http.get(options, function (res) {
          res.resume()
        })
      },
      function onRequest(req, res) {
        res.writeHead(200)
        const headers = res.getHeaders()
        assert.equal(headers['x-newrelic-synthetics'], SYNTHETICS_HEADER)
        assert.equal(headers['x-newrelic-synthetics-info'], SYNTHETICS_INFO_HEADER)
        end()
      }
    )
  })
})
