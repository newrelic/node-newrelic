'use strict'

var benchmark = require('../lib/benchmark')

var suite = benchmark.createBenchmark({
  name: 'async hooks',
  async: true,
  fn: runBenchmark
})

var asyncHooks = require('async_hooks')
var noopHook = asyncHooks.createHook({
  init: function() {},
  before: function() {},
  after: function() {},
  destroy: function() {}
})

var tests = [
  {name: 'no agent, no hooks'},
  {
    name: 'no agent, noop async hooks',
    before: function registerHook() {
      noopHook.enable()
    },
    after: function deregisterHook() {
      noopHook.disable()
    }
  },
  {
    name: 'instrumentation',
    agent: {
      config: {feature_flag: {await_support: false}}
    },
    runInTransaction: true
  },
  {
    name: 'agent async hooks',
    agent: {
      config: {feature_flag: {await_support: true}}
    },
    runInTransaction: true
  }
]

tests.forEach((test) => suite.add(test))

suite.run()

function runBenchmark(agent, cb) {
  var p = Promise.resolve()
  for (var i = 0; i < 300; ++i) {
    p = p.then(function noop() {})
  }
  p.then(cb)
}
