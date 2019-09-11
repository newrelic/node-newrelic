'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')
var hashes = require('../../../lib/util/hashes')
var API = require('../../../api')

// Constants
var CROSS_PROCESS_ID = '1337#7331'
var PORT = 1337

test('background transactions should not blow up with CAT', function(t) {
  t.plan(19)
  var config = {
    cross_application_tracer: {enabled: true},
    trusted_account_ids: [1337],
    cross_process_id: CROSS_PROCESS_ID,
    encoding_key: 'some key',
  }
  config.obfuscatedId =
    hashes.obfuscateNameUsingKey(config.cross_process_id, config.encoding_key)

  const agent = helper.instrumentMockedAgent(config)
  const http = require('http')
  const api = new API(agent)

  var server = http.createServer(function(req, res) {
    t.ok(req.headers['x-newrelic-id'], 'got incoming x-newrelic-id')
    t.ok(req.headers['x-newrelic-transaction'], 'got incoming x-newrelic-transaction')
    req.resume()
    res.end()
  })

  server.listen(PORT, api.startBackgroundTransaction('myTx', function() {
    var tx = api.getTransaction()
    var connOptions = {
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

  var finishedHandlers = [
    function web(trans, event) {
      t.equal(trans.name, 'WebTransaction/NormalizedUri/*', 'got web trans first')
      var intrinsic = event[0]

      t.equal(intrinsic.name, 'WebTransaction/NormalizedUri/*', 'web event has name')
      t.ok(intrinsic['nr.guid'], 'web should have an nr.guid on event')
      t.ok(intrinsic['nr.tripId'], 'web should have an nr.tripId on event')
      t.ok(intrinsic['nr.pathHash'], 'web should have an nr.pathHash on event')
      t.ok(
        intrinsic['nr.referringPathHash'],
        'web should have an nr.referringPathHash on event'
      )
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
      var intrinsic = event[0]

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
      t.notOk(
        intrinsic['nr.apdexPerfZone'],
        'bg should have an nr.apdexPerfZone on event'
      )
      t.notOk(
        intrinsic['nr.alternatePathHashes'],
        'bg should have an nr.alternatePathHashes on event'
      )
    }
  ]
  var count = 0
  agent.on('transactionFinished', function(trans) {
    var event = agent.transactionEventAggregator.getEvents().filter(function(evt) {
      return evt[0]['nr.guid'] === trans.id
    })[0]
    finishedHandlers[count](trans, event)
    count += 1
  })
})
