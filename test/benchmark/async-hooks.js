'use strict'

var helper = require('../lib/agent_helper')
var benchmark = require('../lib/benchmark')

var nativeMetrics
var gcStats = Object.create(null)

try {
  nativeMetrics = require('@newrelic/native-metrics')()
  nativeMetrics.on('gc', (gc) => {
    if (!gcStats[gc.type]) {
      gcStats[gc.type] = {
        count: 1,
        duration: gc.duration * 1e-9
      }
    } else {
      ++gcStats[gc.type].count
      gcStats[gc.type].duration += gc.duration * 1e-9
    }
  })
} catch (e) {
  console.log(`Not recording gc metrics, native metrics failed to load`, e)
}

function printGCStats(event) {
  if (nativeMetrics) {
    var totalDuration = 0
    var totalCount = 0
    var keys = Object.keys(gcStats)
    if (keys.length) {
      console.log([
        '',
        `  GC stats for ${event.target.name}:`
      ].join('\n'))

      for (var i = 0; i < keys.length; ++i) {
        var key = keys[i]
        var stats = gcStats[key]

        console.log([
          '',
          `    ${key} count: ${stats.count}`,
          `    ${key} duration: ${stats.duration} sec`
        ].join('\n'))

        totalDuration += stats.duration
        totalCount += stats.count
      }

      console.log([
        '',
        `  Overall GC stats:`,
        '',
        `    Total GC count: ${totalCount}`,
        `    Total GC duration: ${totalDuration} sec`,
        '',
        `    Duration per test run: ${totalDuration/event.target.cycles}`,
        `    Duration per GC: ${totalDuration/totalCount} sec`,
        ''
      ].join('\n'))

      gcStats = Object.create(null)
    }
  }
}

var suite = benchmark.createBenchmark({
  name: 'async hooks',
  defer: true,
  fn: test,
  afterTest: printGCStats
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
    agent: {feature_flag: {await_support: false}}
  },
  {
    name: 'agent async hooks',
    agent: {feature_flag: {await_support: true}}
  }
]

tests.sort(() => Math.random() - 0.5).forEach((test) => suite.add(test))

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
        cb()
      })
    })
  } else {
    runTest(cb)
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
    })
  }
}
