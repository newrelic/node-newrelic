'use strict'

var helper = require('../lib/agent_helper')
var benchmark = require('../lib/benchmark')

var suite = benchmark.createBenchmark('async hooks')

suite.add({
  name: 'instrumentation',
  async: true,
  agent: true,
  fn: test
})

suite.add({
  name: 'native hooks',
  async: true,
  agent: {
    feature_flag: {await_support: true},
    config: {transaction_tracer: {
      enable_native: true,
      enable_hooks: false
    }}},
  fn: test
})

suite.add({
  name: 'async hooks',
  async: true,
  agent: {
    feature_flag: {await_support: true},
    config: {transaction_tracer: {
      enable_native: false,
      enable_hooks: true
    }}},
  fn: test
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
