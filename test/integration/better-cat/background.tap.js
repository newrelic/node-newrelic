'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const hashes = require('../../../lib/util/hashes')
const API = require('../../../api')

// Constants
const CROSS_PROCESS_ID = '1337#7331'
const PORT = 1337

let compareSampled = null

tap.test('background transactions should not blow up with CAT', (t) => {
  t.plan(26)
  const config = {
    feature_flag: {distributed_tracing: true},
    cross_application_tracer: {enabled: true},
    trusted_account_ids: ['1337'],
    cross_process_id: CROSS_PROCESS_ID,
    encoding_key: 'some key',
  }
  config.obfuscatedId = hashes.obfuscateNameUsingKey(config.cross_process_id,
                                                     config.encoding_key)
  const agent = helper.instrumentMockedAgent(null, config)
  const http = require('http')
  const api = new API(agent)

  const server = http.createServer(function(req, res) {
    t.ok(req.headers['x-newrelic-trace'], 'got incoming x-newrelic-trace')

    req.resume()
    res.end()
  })

  server.listen(PORT, api.startBackgroundTransaction('myTx', function() {
    const tx = api.getTransaction()
    const connOptions = {
      hostname: 'localhost',
      port: PORT,
      path: '/thing'
    }

    http.get(connOptions, function(res) {
      res.resume()
      server.close()
      tx.end()
    })
  }))

  const finishedHandlers = [
    function web(trans, event) {
      t.equal(trans.name, 'WebTransaction/NormalizedUri/*', 'got web trans first')
      const intrinsic = event[0]

      t.equal(intrinsic.name, 'WebTransaction/NormalizedUri/*', 'web event has name')
      t.ok(intrinsic['nr.tripId'], 'web should have an nr.tripId on event')
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

      t.ok(intrinsic['nr.tripId'], 'bg should have an nr.tripId on event')
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
    const event = agent.events.toArray().filter(function(evt) {
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
