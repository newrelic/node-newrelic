'use strict'

var helper = require('../lib/agent_helper')
var benchmark = require('../lib/benchmark')

var suite = benchmark.createBenchmark({
  name: 'async hooks',
  async: true,
  fn: test
})

suite.add({
  name: 'instrumentation',
  agent: {feature_flag: {await_support: false}}
})

suite.add({
  name: 'async hooks',
  agent: {feature_flag: {await_support: true}}
})

suite.run()

function test(agent, cb) {
  helper.runInTransaction(agent, function inTx(tx) {
    var segment = agent.tracer.segment

    var p = Promise.resolve()
    for (var i = 0; i < 300; ++i) {
      p = p.then(function noop() {})
    }
    p.then(function checkState() {
      if (agent.tracer.segment !== segment) {
        throw new Error('Lost transaction state!')
      }
      tx.end()
      cb()
    })
  })
}
