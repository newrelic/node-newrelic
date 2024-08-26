/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const helper = require('../../../lib/agent_helper')
const http = require('http')
const agent = helper.instrumentMockedAgent()

const server = http.createServer(function createServerCb(request, response) {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end()
})

process.once('uncaughtException', function () {
  const errors = agent.errors.traceAggregator.errors
  assert.equal(errors.length, 1)

  server.close(process.exit)
})

server.listen(8183, function () {
  http.get({ host: 'localhost', port: 8183 }, function () {
    throw new Error('whoah')
  })
})
