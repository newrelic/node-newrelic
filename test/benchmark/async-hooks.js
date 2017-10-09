'use strict'

var helper = require('../lib/agent_helper')
var benchmark = require('../lib/benchmark')

var suite = benchmark.createBenchmark({
  name: 'async hooks',
  async: true,
  fn: test
})

suite.add({
  name: 'no agent, noop async hooks',
  before: function registerHook() {
    noopHook.enable()
  },
  after: function deregisterHook() {
    noopHook.disable()
  }
})

suite.add({
  name: 'no agent, no hooks'
})

suite.add({
  name: 'instrumentation',
  agent: {feature_flag: {await_support: false}}
})

suite.add({
  name: 'agent async hooks',
  agent: {feature_flag: {await_support: true}}
})

var asyncHooks = require('async_hooks')
var noopHook = asyncHooks.createHook({
  init: function() {},
  before: function() {},
  after: function() {},
  destroy: function() {}
})

suite.run()

function test(agent, cb) {
  if (agent) {
    helper.runInTransaction(agent, function inTx(tx) {
      var segment = agent.tracer.segment
      runTest(function onEnd() {
        if (agent.tracer.segment !== segment) {
          throw new Error('Lost transaction state!')
        }
        tx.end()
      })
    })
  } else {
    runTest()
  }

  function runTest(onEnd) {
    var p = Promise.resolve()
    for (var i = 0; i < 300; ++i) {
      p = p.then(function noop() {})
    }
    p.then(function checkState() {
      if (onEnd) {
        onEnd()
      }
      cb()
    })
  }
}
