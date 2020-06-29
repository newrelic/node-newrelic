/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')

let compareSampled = null

tap.test('background transactions should not blow up with DT', (t) => {
  t.plan(24)
  const config = {
    distributed_tracing: {
      enabled: true
    },
    cross_application_tracer: {enabled: false},
    account_id: '1337',
    primary_application_id: '7331',
    trusted_account_key: '1337',
    encoding_key: 'some key',
  }

  const agent = helper.instrumentMockedAgent(config)

  agent.config.account_id = '1337'
  agent.config.primary_application_id = '7331'
  agent.config.trusted_account_key = '1337'

  const http = require('http')
  const api = new API(agent)

  const server = http.createServer(function(req, res) {
    t.ok(req.headers.newrelic, 'got incoming newrelic header')

    req.resume()
    res.end()
  })

  server.listen(() => {
    api.startBackgroundTransaction('myTx', function() {
      const tx = api.getTransaction()
      const connOptions = {
        hostname: 'localhost',
        port: server.address().port,
        path: '/thing'
      }

      http.get(connOptions, function(res) {
        res.resume()
        server.close()
        tx.end()
      })
    })
  })

  const finishedHandlers = [
    function web(trans, event) {
      t.equal(trans.name, 'WebTransaction/NormalizedUri/*', 'got web trans first')
      const intrinsic = event[0]

      t.equal(intrinsic.name, 'WebTransaction/NormalizedUri/*', 'web event has name')
      t.ok(intrinsic.guid, 'web should have a guid on event')
      t.ok(intrinsic.traceId, 'web should have a traceId on event')
      t.ok(intrinsic.priority, 'web should have a priority on event')
      t.ok(intrinsic.sampled != null, 'web should have a sampled boolean on event')
      t.ok(intrinsic.parentId, 'web should have parentId on event')
      t.ok(intrinsic['parent.type'], 'web should have parent type on event')
      t.ok(intrinsic['parent.app'], 'web should have parent app on event')
      t.ok(intrinsic['parent.account'], 'web should have parent account on event')
      t.ok(
        intrinsic['parent.transportType'],
        'web should have parent transport type on event'
      )
      t.ok(
        intrinsic['parent.transportDuration'],
        'web should have parent transport duration on event'
      )
      t.notOk(
        intrinsic['nr.alternatePathHashes'],
        'web should not have an nr.alternatePathHashes on event'
      )

      compareSampled = currySampled(t, {
        sampled: intrinsic.sampled,
        priority: intrinsic.priority
      })
    },
    function background(trans, event) {
      t.equal(trans.name, 'OtherTransaction/Nodejs/myTx', 'got background trans second')
      const intrinsic = event[0]

      t.ok(intrinsic.traceId, 'bg should have a traceId on event')
      t.ok(intrinsic.priority, 'bg should have a priority on event')
      t.ok(intrinsic.guid, 'bg should have a guid on event')
      t.ok(intrinsic.sampled != null, 'bg should have a sampled boolean on event')
      t.notOk(
        intrinsic['nr.referringPathHash'],
        'bg should not have an nr.referringPathHash on event'
      )
      t.notOk(
        intrinsic['nr.referringTransactionGuid'],
        'bg should not have an nr.referringTransactionGuid on event'
      )
      t.notOk(
        intrinsic['nr.apdexPerfZone'],
        'bg should have an nr.apdexPerfZone on event'
      )
      t.notOk(
        intrinsic['nr.alternatePathHashes'],
        'bg should have an nr.alternatePathHashes on event'
      )

      compareSampled({
        sampled: intrinsic.sampled,
        priority: intrinsic.priority
      })
    }
  ]
  let count = 0
  agent.on('transactionFinished', function(trans) {
    const event = agent.transactionEventAggregator.getEvents().filter(function(evt) {
      return evt[0].guid === trans.id
    })[0]
    finishedHandlers[count](trans, event)
    count += 1
  })
})

function currySampled(t, a) {
  return (b) => {
    b = b || a
    t.ok(
      a.sampled === b.sampled && a.priority === b.priority,
      'sampled values and priority persist across transactions'
    )
    a = b
    return b
  }
}
