'use strict'

const benchmark = require('../../lib/benchmark')
const helper = require('../../lib/agent_helper')
const http = require('http')
let agent = null

const suite = benchmark.createBenchmark({name: 'http'})

suite.add({
  name: 'uninstrumented http.Server',
  fn: runTest
})

suite.add({
  name: 'instrumented http.Server',
  before: () => {
    agent = helper.instrumentMockedAgent()
  },
  fn: runTest,
  after: () => {
    helper.unloadAgent(agent)
  }
})

global.gc && global.gc()
setTimeout(function() {
  suite.run()
}, 500)

function runTest() {
  const server = http.createServer((req, res) => {
    res.end()
  })

  server.listen(3000, () => {
    const req = http.request({
      host: 'localhost',
      port: 3000,
      method: 'GET'
    })
    req.end()
  })

  server.close()
}
