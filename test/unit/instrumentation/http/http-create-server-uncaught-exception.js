/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const http = require('http')
const helper = require('../../../lib/agent_helper')
const agent = helper.instrumentMockedAgent()
const err = new Error('whoops')

const server = http.createServer(function createServerCb() {
  throw err
})
let request

process.once('uncaughtException', function () {
  const errors = agent.errors.traceAggregator.errors
  assert.equal(errors.length, 1)

  // abort request to close connection and
  // allow server to close fast instead of after timeout
  request.abort()
  server.close(process.exit)
})

server.listen(8182, function () {
  request = http.get({ host: 'localhost', port: 8182 }, function () {})

  request.on('error', function swallowError(swallowedError) {
    assert.notEqual(swallowedError.message, err.message, 'error should have been swallowed')
  })
})
