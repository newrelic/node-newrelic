/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const http = require('http')

const suite = benchmark.createBenchmark({ name: 'http', runs: 5000 })

let server = null
const PORT = 3000

suite.add({
  name: 'uninstrumented http.Server',
  async: true,
  initialize: createServer,
  fn: (agent, done) => makeRequest(done),
  teardown: closeServer
})

suite.add({
  name: 'instrumented http.Server',
  agent: {},
  async: true,
  initialize: createServer,
  fn: (agent, done) => makeRequest(done),
  teardown: closeServer
})

suite.run()

function createServer() {
  server = http.createServer((req, res) => {
    res.end()
  })
  server.listen(PORT)
}

function closeServer() {
  server && server.close()
  server = null
}

function makeRequest(cb) {
  http.request({ port: PORT }, cb).end()
}
