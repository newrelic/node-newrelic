/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')

const helper = require('../../lib/agent_helper')
const API = require('../../../api')

let compareSampled = null

test('background transactions should not blow up with DT', async (t) => {
  const plan = tspl(t, { plan: 24 })

  const config = {
    distributed_tracing: {
      enabled: true
    },
    cross_application_tracer: { enabled: false },
    account_id: '1337',
    primary_application_id: '7331',
    trusted_account_key: '1337',
    encoding_key: 'some key'
  }

  const agent = helper.instrumentMockedAgent(config)

  agent.config.distributed_tracing.account_id = '1337'
  agent.config.primary_application_id = '7331'
  agent.config.trusted_account_key = '1337'

  const http = require('http')
  const api = new API(agent)

  const server = http.createServer(function (req, res) {
    plan.ok(req.headers.newrelic, 'got incoming newrelic header')

    req.resume()
    res.end()
  })

  server.listen(() => {
    api.startBackgroundTransaction('myTx', function () {
      const tx = api.getTransaction()
      const connOptions = {
        hostname: 'localhost',
        port: server.address().port,
        path: '/thing'
      }

      http.get(connOptions, function (res) {
        res.resume()
        server.close()
        tx.end()
      })
    })
  })

  const finishedHandlers = [
    function web(trans, event) {
      plan.equal(trans.name, 'WebTransaction/NormalizedUri/*', 'got web trans first')
      const intrinsic = event[0]

      plan.equal(intrinsic.name, 'WebTransaction/NormalizedUri/*', 'web event has name')
      plan.ok(intrinsic.guid, 'web should have a guid on event')
      plan.ok(intrinsic.traceId, 'web should have a traceId on event')
      plan.ok(intrinsic.priority, 'web should have a priority on event')
      plan.ok(intrinsic.sampled != null, 'web should have a sampled boolean on event')
      plan.ok(intrinsic.parentId, 'web should have parentId on event')
      plan.ok(intrinsic['parent.type'], 'web should have parent type on event')
      plan.ok(intrinsic['parent.app'], 'web should have parent app on event')
      plan.ok(intrinsic['parent.account'], 'web should have parent account on event')
      plan.ok(intrinsic['parent.transportType'], 'web should have parent transport type on event')
      plan.ok(
        intrinsic['parent.transportDuration'],
        'web should have parent transport duration on event'
      )
      plan.equal(
        intrinsic['nr.alternatePathHashes'],
        undefined,
        'web should not have an nr.alternatePathHashes on event'
      )

      compareSampled = currySampled(plan, {
        sampled: intrinsic.sampled,
        priority: intrinsic.priority
      })
    },
    function background(trans, event) {
      plan.equal(trans.name, 'OtherTransaction/Nodejs/myTx', 'got background trans second')
      const intrinsic = event[0]

      plan.ok(intrinsic.traceId, 'bg should have a traceId on event')
      plan.ok(intrinsic.priority, 'bg should have a priority on event')
      plan.ok(intrinsic.guid, 'bg should have a guid on event')
      plan.ok(intrinsic.sampled != null, 'bg should have a sampled boolean on event')
      plan.equal(
        intrinsic['nr.referringPathHash'],
        undefined,
        'bg should not have an nr.referringPathHash on event'
      )
      plan.equal(
        intrinsic['nr.referringTransactionGuid'],
        undefined,
        'bg should not have an nr.referringTransactionGuid on event'
      )
      plan.equal(
        intrinsic['nr.apdexPerfZone'],
        undefined,
        'bg should have an nr.apdexPerfZone on event'
      )
      plan.equal(
        intrinsic['nr.alternatePathHashes'],
        undefined,
        'bg should have an nr.alternatePathHashes on event'
      )

      compareSampled({
        sampled: intrinsic.sampled,
        priority: intrinsic.priority
      })
    }
  ]
  let count = 0
  agent.on('transactionFinished', function (trans) {
    const event = agent.transactionEventAggregator.getEvents().filter(function (evt) {
      return evt[0].guid === trans.id
    })[0]
    finishedHandlers[count](trans, event)
    count += 1
  })

  await plan.completed
})

function currySampled(plan, a) {
  return (b) => {
    b = b || a
    plan.ok(
      a.sampled === b.sampled && a.priority === b.priority,
      'sampled values and priority persist across transactions'
    )
    a = b
    return b
  }
}
