/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')
var cp = require('child_process')
var path = require('path')
var hashes = require('../../../lib/util/hashes')


test('client_cross_process_id in called service', function(t) {
  let startedCalled = false
  let transactionFinishedCalled = false

  var config = {
    cross_application_tracer: {enabled: true},
    trusted_account_ids: [2448],
    cross_process_id: '1337#7331',
    encoding_key: 'some key',
  }
  config.obfuscatedId =
    hashes.obfuscateNameUsingKey(config.cross_process_id, config.encoding_key)

  var agent = helper.instrumentMockedAgent(config)
  // require http after creating the agent
  var http = require('http')

  var p = path.resolve(__dirname)
  var child = cp.fork(path.join(p, 'server2.js'), {silent: false})

  child.on('message', function(msg) {
    if (msg.message === 'started') {
      startedCalled = true

      var port = msg.port

      helper.runInTransaction(agent, function(tx) {
        http.get('http://localhost:' + port, function(response) {
          response.resume()
          tx.end()
        })
      })
    } else if (msg.message === 'transactionFinished') {
      transactionFinishedCalled = true

      var intrinsics = msg.intrinsicAttributes
      t.equal(
        intrinsics.client_cross_process_id, config.cross_process_id,
        'client_cross_process_id attribute should equal cross_process_id of caller'
      )

      child.kill()
    }
  })

  child.on('exit', function() {
    t.ok(startedCalled, 'should have hit started state')
    t.ok(transactionFinishedCalled, 'should have hit transactionFinished state')
    t.end()
  })
})
