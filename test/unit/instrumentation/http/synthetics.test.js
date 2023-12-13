/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../../lib/agent_helper')
const {
  SYNTHETICS_DATA,
  SYNTHETICS_INFO,
  SYNTHETICS_HEADER,
  SYNTHETICS_INFO_HEADER,
  ENCODING_KEY
} = require('../../../helpers/synthetics')

tap.test('synthetics outbound header', (t) => {
  let http
  let server
  let agent

  let port = null
  const CONNECT_PARAMS = {
    hostname: 'localhost'
  }

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({
      cross_application_tracer: { enabled: true },
      trusted_account_ids: [23, 567],
      encoding_key: ENCODING_KEY
    })
    http = require('http')
    server = http.createServer(function (req, res) {
      req.resume()
      res.end()
    })

    return new Promise((resolve) => {
      server.listen(0, function () {
        ;({ port } = this.address())
        resolve()
      })
    })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    return new Promise((resolve) => {
      server.close(resolve)
    })
  })

  t.test('should be propagated if on tx', (t) => {
    helper.runInTransaction(agent, function (transaction) {
      transaction.syntheticsData = SYNTHETICS_DATA
      transaction.syntheticsHeader = SYNTHETICS_HEADER
      transaction.syntheticsInfoData = SYNTHETICS_INFO
      transaction.syntheticsInfoHeader = SYNTHETICS_INFO_HEADER
      CONNECT_PARAMS.port = port
      const req = http.request(CONNECT_PARAMS, function (res) {
        res.resume()
        transaction.end()
        t.equal(res.headers['x-newrelic-synthetics'], SYNTHETICS_HEADER)
        t.equal(res.headers['x-newrelic-synthetics-info'], SYNTHETICS_INFO_HEADER)
        t.end()
      })
      const headers = req.getHeaders()
      t.equal(headers['x-newrelic-synthetics'], SYNTHETICS_HEADER)
      t.equal(headers['x-newrelic-synthetics-info'], SYNTHETICS_INFO_HEADER)
      req.end()
    })
  })

  t.test('should not be propagated if not on tx', (t) => {
    helper.runInTransaction(agent, function (transaction) {
      CONNECT_PARAMS.port = port
      http.get(CONNECT_PARAMS, function (res) {
        res.resume()
        transaction.end()
        t.notOk(res.headers['x-newrelic-synthetics'])
        t.notOk(res.headers['x-newrelic-synthetics-info'])
        t.end()
      })
    })
  })

  t.end()
})

tap.test('should add synthetics inbound header to transaction', (t) => {
  let http
  let server
  let agent
  const CONNECT_PARAMS = {
    hostname: 'localhost'
  }

  function createServer(cb, requestHandler) {
    http = require('http')
    const s = http.createServer(function (req, res) {
      requestHandler(req, res)
      res.end()
      req.resume()
    })
    s.listen(0, cb)
    return s
  }

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({
      cross_application_tracer: { enabled: true },
      distributed_tracing: { enabled: false },
      trusted_account_ids: [23, 567],
      encoding_key: ENCODING_KEY
    })

    http = require('http')
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    return new Promise((resolve) => {
      server.close(resolve)
    })
  })

  t.test('should exist if account id and version are ok', (t) => {
    const options = Object.assign({}, CONNECT_PARAMS)
    options.headers = {
      'X-NewRelic-Synthetics': SYNTHETICS_HEADER,
      'X-NewRelic-Synthetics-Info': SYNTHETICS_INFO_HEADER
    }
    server = createServer(
      function onListen() {
        options.port = this.address().port
        http.get(options, function (res) {
          res.resume()
        })
      },
      function onRequest() {
        const tx = agent.getTransaction()
        t.ok(tx)
        t.match(
          tx,
          {
            syntheticsHeader: SYNTHETICS_HEADER,
            syntheticsInfoHeader: SYNTHETICS_INFO_HEADER
          },
          'synthetics header added to intrinsics with distributed tracing enabled'
        )
        t.type(tx.syntheticsData, 'object')
        t.same(tx.syntheticsData, SYNTHETICS_DATA)
        t.same(tx.syntheticsInfoData, SYNTHETICS_INFO)
        t.end()
      }
    )
  })

  t.test('should not exist if account id and version are not ok', (t) => {
    const options = Object.assign({}, CONNECT_PARAMS)
    options.headers = {
      'X-NewRelic-Synthetics': 'bsstuff',
      'X-NewRelic-Synthetics-Info': 'noinfo'
    }
    server = createServer(
      function onListen() {
        options.port = this.address().port
        http.get(options, function (res) {
          res.resume()
        })
      },
      function onRequest() {
        const tx = agent.getTransaction()
        t.ok(tx)
        t.notOk(tx.syntheticsHeader)
        t.notOk(tx.syntheticsInfoHeader)
        t.end()
      }
    )
  })

  t.test('should propagate inbound synthetics header on response', (t) => {
    const options = Object.assign({}, CONNECT_PARAMS)
    options.headers = {
      'X-NewRelic-Synthetics': SYNTHETICS_HEADER,
      'X-NewRelic-Synthetics-Info': SYNTHETICS_INFO_HEADER
    }
    server = createServer(
      function onListen() {
        options.port = this.address().port
        http.get(options, function (res) {
          res.resume()
        })
      },
      function onRequest(req, res) {
        res.writeHead(200)
        t.match(res.getHeaders(), {
          'x-newrelic-synthetics': SYNTHETICS_HEADER,
          'x-newrelic-synthetics-info': SYNTHETICS_INFO_HEADER
        })
        t.end()
      }
    )
  })

  t.end()
})
