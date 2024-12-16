/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const cp = require('child_process')
const path = require('path')
const hashes = require('../../../lib/util/hashes')
const { tspl } = require('@matteo.collina/tspl')

test('client_cross_process_id in called service', async function (t) {
  const plan = tspl(t, { plan: 3 })
  let startedCalled = false
  let transactionFinishedCalled = false

  const config = {
    cross_application_tracer: { enabled: true },
    distributed_tracing: { enabled: false },
    trusted_account_ids: [2448],
    cross_process_id: '1337#7331',
    encoding_key: 'some key'
  }
  config.obfuscatedId = hashes.obfuscateNameUsingKey(config.cross_process_id, config.encoding_key)

  const agent = helper.instrumentMockedAgent(config)
  // require http after creating the agent
  const http = require('http')

  const p = path.resolve(__dirname)
  const child = cp.fork(path.join(p, 'server2.js'), { silent: false })

  child.on('message', function (msg) {
    if (msg.message === 'started') {
      startedCalled = true

      const port = msg.port

      helper.runInTransaction(agent, function (tx) {
        http.get('http://localhost:' + port, function (response) {
          response.resume()
          tx.end()
        })
      })
    } else if (msg.message === 'transactionFinished') {
      transactionFinishedCalled = true

      const intrinsics = msg.intrinsicAttributes
      plan.equal(
        intrinsics.client_cross_process_id,
        config.cross_process_id,
        'client_cross_process_id attribute should equal cross_process_id of caller'
      )

      child.kill()
    }
  })

  child.on('exit', function () {
    plan.ok(startedCalled, 'should have hit started state')
    plan.ok(transactionFinishedCalled, 'should have hit transactionFinished state')
  })
  await plan.completed
})
