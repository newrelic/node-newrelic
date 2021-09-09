/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const hashes = require('../../../lib/util/hashes')

const config = {
  cross_application_tracer: { enabled: true },
  distributed_tracing: { enabled: false },
  trusted_account_ids: [1337],
  cross_process_id: '2448#8442',
  encoding_key: 'some key'
}
config.obfuscatedId = hashes.obfuscateNameUsingKey(config.cross_process_id, config.encoding_key)

const agent = helper.instrumentMockedAgent(config)

// require http after creating the agent
const http = require('http')

const server = http.createServer(function (req, res) {
  res.end()
})

server.listen(0, function () {
  process.send({ message: 'started', port: server.address().port })
})

agent.on('transactionFinished', function (tx) {
  process.send({
    message: 'transactionFinished',
    intrinsicAttributes: tx.trace.intrinsics
  })
})
