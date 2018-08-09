'use strict'

const benchmark = require('../../lib/benchmark')
const http = require('http')

const suite = benchmark.createBenchmark({name: 'http'})

let server = null
const PORT = 3000

suite.add({
  name: 'uninstrumented http.Server',
  defer: true,
  before: createServer,
  fn: (agent, cb) => makeRequest(cb),
  after: closeServer
})

suite.add({
  name: 'instrumented http.Server',
  agent: true,
  defer: true,
  before: createServer,
  fn: (agent, cb) => makeRequest(cb),
  after: closeServer
})

global.gc && global.gc()
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
  http.request({port: PORT}, cb).end()
}
