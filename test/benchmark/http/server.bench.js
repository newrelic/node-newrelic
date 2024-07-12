/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const http = require('http')

const suite = benchmark.createBenchmark({ name: 'http', runs: 5000 })

const HOST = 'localhost'
// manage the servers separately
// since we have to enqueue the server.close
// to avoid net connect errors
const servers = {
  3000: null,
  3001: null
}

suite.add({
  name: 'uninstrumented http.Server',
  initialize: createServer(3000),
  fn: setupRequest(3000),
  teardown: closeServer(3000)
})

suite.add({
  name: 'instrumented http.Server',
  agent: {},
  initialize: createServer(3001),
  fn: setupRequest(3001),
  teardown: closeServer(3001)
})

suite.run()

function createServer(port) {
  return async function makeServer() {
    return new Promise((resolve, reject) => {
      servers[port] = http.createServer((req, res) => {
        res.end()
      })
      servers[port].listen(port, HOST, (err) => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  }
}

function closeServer(port) {
  return function close() {
    setImmediate(() => {
      servers[port].close()
    })
  }
}

function setupRequest(port) {
  return async function makeRequest() {
    return new Promise((resolve) => {
      http.request({ host: HOST, port }, resolve).end()
    })
  }
}
