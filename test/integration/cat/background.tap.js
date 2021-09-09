/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')
const hashes = require('../../../lib/util/hashes')
const API = require('../../../api')

// Constants
const CROSS_PROCESS_ID = '1337#7331'
const PORT = 1337

test('background transactions should not blow up with CAT', function (t) {
  t.plan(19)
  const config = {
    cross_application_tracer: { enabled: true },
    distributed_tracing: { enabled: false },
    trusted_account_ids: [1337],
    cross_process_id: CROSS_PROCESS_ID,
    encoding_key: 'some key'
  }
  config.obfuscatedId = hashes.obfuscateNameUsingKey(config.cross_process_id, config.encoding_key)

  const agent = helper.instrumentMockedAgent(config)
  const http = require('http')
  const api = new API(agent)

  const server = http.createServer(function (req, res) {
    t.ok(req.headers['x-newrelic-id'], 'got incoming x-newrelic-id')
    t.ok(req.headers['x-newrelic-transaction'], 'got incoming x-newrelic-transaction')
    req.resume()
    res.end()
  })

  server.listen(
    PORT,
    api.startBackgroundTransaction('myTx', function () {
      const tx = api.getTransaction()
      const connOptions = {
        hostname: 'localhost',
        port: PORT,
        path: '/thing'
      }
      http.get(connOptions, function (res) {
        res.resume()
        server.close()
        tx.end()
      })
    })
  )

  const finishedHandlers = [
    function web(trans, event) {
      t.equal(trans.name, 'WebTransaction/NormalizedUri/*', 'got web trans first')
      const intrinsic = event[0]

      t.equal(intrinsic.name, 'WebTransaction/NormalizedUri/*', 'web event has name')
      t.ok(intrinsic['nr.guid'], 'web should have an nr.guid on event')
      t.ok(intrinsic['nr.tripId'], 'web should have an nr.tripId on event')
      t.ok(intrinsic['nr.pathHash'], 'web should have an nr.pathHash on event')
      t.ok(intrinsic['nr.referringPathHash'], 'web should have an nr.referringPathHash on event')
      t.ok(
        intrinsic['nr.referringTransactionGuid'],
        'web should have an nr.referringTransactionGuid on event'
      )
      t.ok(intrinsic['nr.apdexPerfZone'], 'web should have an nr.apdexPerfZone on event')
      t.notOk(
        intrinsic['nr.alternatePathHashes'],
        'web should not have an nr.alternatePathHashes on event'
      )
    },
    function background(trans, event) {
      t.equal(trans.name, 'OtherTransaction/Nodejs/myTx', 'got background trans second')
      const intrinsic = event[0]

      t.ok(intrinsic['nr.guid'], 'bg should have an nr.guid on event')
      t.ok(intrinsic['nr.tripId'], 'bg should have an nr.tripId on event')
      t.ok(intrinsic['nr.pathHash'], 'bg should have an nr.pathHash on event')
      t.notOk(
        intrinsic['nr.referringPathHash'],
        'bg should not have an nr.referringPathHash on event'
      )
      t.notOk(
        intrinsic['nr.referringTransactionGuid'],
        'bg should not have an nr.referringTransactionGuid on event'
      )
      t.notOk(intrinsic['nr.apdexPerfZone'], 'bg should have an nr.apdexPerfZone on event')
      t.notOk(
        intrinsic['nr.alternatePathHashes'],
        'bg should have an nr.alternatePathHashes on event'
      )
    }
  ]
  let count = 0
  agent.on('transactionFinished', function (trans) {
    const event = agent.transactionEventAggregator.getEvents().filter(function (evt) {
      return evt[0]['nr.guid'] === trans.id
    })[0]
    finishedHandlers[count](trans, event)
    count += 1
  })
})
