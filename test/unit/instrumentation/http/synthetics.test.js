/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const hashes = require('../../../../lib/util/hashes')
const helper = require('../../../lib/agent_helper')

tap.test('synthetics outbound header', (t) => {
  let http
  let server
  let agent
  const ENCODING_KEY = 'Old Spice'
  const SYNTHETICS_DATA_ARRAY = [
    1, // version
    567, // account id
    'moe', // synthetics resource id
    'larry', // synthetics job id
    'curly' // synthetics monitor id
  ]
  const SYNTHETICS_DATA = {
    version: SYNTHETICS_DATA_ARRAY[0],
    accountId: SYNTHETICS_DATA_ARRAY[1],
    resourceId: SYNTHETICS_DATA_ARRAY[2],
    jobId: SYNTHETICS_DATA_ARRAY[3],
    monitorId: SYNTHETICS_DATA_ARRAY[4]
  }
  const SYNTHETICS_HEADER = hashes.obfuscateNameUsingKey(
    JSON.stringify(SYNTHETICS_DATA_ARRAY),
    ENCODING_KEY
  )

  const PORT = 9873
  const CONNECT_PARAMS = {
    hostname: 'localhost',
    port: PORT
  }

  t.beforeEach((done) => {
    agent = helper.instrumentMockedAgent({
      cross_application_tracer: {enabled: true},
      trusted_account_ids: [23, 567],
      encoding_key: ENCODING_KEY
    })
    http = require('http')
    server = http.createServer(function(req, res) {
      req.resume()
      res.end()
    })
    server.listen(PORT, done)
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    server.close(function() {
      done()
    })
  })

  t.test('should be propegated if on tx', (t) => {
    helper.runInTransaction(agent, function(transaction) {
      transaction.syntheticsData = SYNTHETICS_DATA
      transaction.syntheticsHeader = SYNTHETICS_HEADER
      const req = http.request(CONNECT_PARAMS, function(res) {
        res.resume()
        transaction.end()
        t.equal(res.headers['x-newrelic-synthetics'], SYNTHETICS_HEADER)
        t.end()
      })
      req.end()
    })
  })

  t.test('should not be propegated if not on tx', (t) => {
    helper.runInTransaction(agent, function(transaction) {
      http.get(CONNECT_PARAMS, function(res) {
        res.resume()
        transaction.end()
        t.notOk(res.headers['x-newrelic-synthetics'])
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
  let synthData

  const ENCODING_KEY = 'Old Spice'

  const PORT = 9873
  const CONNECT_PARAMS = {
    hostname: 'localhost',
    port: PORT
  }

  function createServer(done, requestHandler) {
    http = require('http')
    const s = http.createServer(function(req, res) {
      requestHandler(req, res)
      res.end()
      req.resume()
    })
    s.listen(PORT, done)
    return s
  }

  t.beforeEach((done) => {
    synthData = [
      1, // version
      567, // account id
      'moe', // synthetics resource id
      'larry', // synthetics job id
      'curly' // synthetics monitor id
    ]
    agent = helper.instrumentMockedAgent({
      distributed_tracing: {enabled: false},
      trusted_account_ids: [23, 567],
      encoding_key: ENCODING_KEY
    })

    http = require('http')
    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    server.close(done)
  })

  t.test('should exist if account id and version are ok', (t) => {
    const synthHeader = hashes.obfuscateNameUsingKey(
      JSON.stringify(synthData),
      ENCODING_KEY
    )
    const options = Object.assign({}, CONNECT_PARAMS)
    options.headers = {
      'X-NewRelic-Synthetics': synthHeader
    }
    server = createServer(
      function onListen() {
        http.get(options, function(res) {
          res.resume()
        })
      },
      function onRequest() {
        const tx = agent.getTransaction()
        t.ok(tx)
        t.match(tx, {
          syntheticsHeader: synthHeader
        }, 'synthetics header added to intrinsics with distributed tracing enabled')
        t.type(tx.syntheticsData, 'object')
        t.match(tx.syntheticsData, {
          version: synthData[0],
          accountId: synthData[1],
          resourceId: synthData[2],
          jobId: synthData[3],
          monitorId: synthData[4]
        })
        t.end()
      }
    )
  })

  t.test('should propegate inbound synthetics header on response', (t) => {
    const synthHeader = hashes.obfuscateNameUsingKey(
      JSON.stringify(synthData),
      ENCODING_KEY
    )
    const options = Object.assign({}, CONNECT_PARAMS)
    options.headers = {
      'X-NewRelic-Synthetics': synthHeader
    }
    server = createServer(
      function onListen() {
        http.get(options, function(res) {
          res.resume()
        })
      },
      function onRequest(req, res) {
        res.writeHead(200)
        t.match(res._headers, {
          'x-newrelic-synthetics': synthHeader
        })
        t.end()
      }
    )
  })

  t.end()
})
