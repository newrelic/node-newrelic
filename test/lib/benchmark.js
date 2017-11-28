'use strict'

var benchmark = require('benchmark')
var copy = require('../../lib/util/copy')
var helper = require('./agent_helper')


exports.createBenchmark = function createBenchmark(opts) {
  return new Benchmark(opts)
}

function Benchmark(opts) {
  this._suite = new benchmark.Suite(opts.name)
  this._opts = opts

  this._suite.on('cycle', function printResult(event) {
    console.log(event.target.toString()) // eslint-disable-line no-console
    if (opts.afterTest) {
      opts.afterTest(event)
    }
  })
}

Benchmark.prototype.add = function add(opts) {
  var testOpts = {async: true, delay: 0.01}
  var mergedOpts = copy.shallow(this._opts)
  var agent = null
  copy.shallow(opts, mergedOpts)

  if (mergedOpts.defer) {
    testOpts.defer = true
    testOpts.fn = function asyncTest(deferred) {
      mergedOpts.fn(agent, function testEnd() {
        deferred.resolve()
      })
    }
  } else {
    testOpts.fn = function syncTest() {
      mergedOpts.fn(agent)
    }
  }

  testOpts.onStart = function testStart() {
    if (opts.before) {
      opts.before()
    }

    if (mergedOpts.agent && !agent) {
      agent = helper.instrumentMockedAgent(
        mergedOpts.agent.feature_flag,
        mergedOpts.agent.config
      )
    }
  }

  testOpts.onComplete = function testComplete() {
    if (opts.after) {
      opts.after()
    }

    if (mergedOpts.agent) {
      helper.unloadAgent(agent)
    }

    if (global.gc) {
      global.gc()
    }
  }

  this._suite.add(opts.name, testOpts)
}

Benchmark.prototype.run = function run() {
  this._suite.run({async: true})
}
