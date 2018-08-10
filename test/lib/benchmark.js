'use strict'

var benchmark = require('benchmark')
var copy = require('../../lib/util/copy')
var helper = require('./agent_helper')
var async = require('async')


exports.createBenchmark = function createBenchmark(opts) {
  return new Benchmark(opts)
}

function Benchmark(opts) {
  this.name = opts.name || "Anonymous Suite"
  if (!opts.runs) {
    opts.runs = 1000
  }
  this.numRuns = opts.runs
  this.opts = opts

  // Aggregation collections
  this.tests = []
  this.samples = {}
  this.processedSamples = {}
}

Benchmark.prototype.add = function add(opts) {
  opts = Object.assign({}, this.opts, opts)
  this.tests.push(opts)
}

Benchmark.prototype.processSamples = function processSamples() {
  var samples = this.samples
  return this.processedSamples = Object.keys(samples).reduce((acc, sampleName) => {
    acc[sampleName] = new BenchmarkStats(samples[sampleName])
    return acc
  }, {})
}

Benchmark.prototype.print = function print() {
  console.log(JSON.stringify(this.processSamples(), null, 2))
}

Benchmark.prototype.run = function run(cb) {
  var delay = this.delay
  var suite = this
  var agent = null

  async.eachSeries(this.tests, function startTest(test, callback) {
    if (test.agent) {
      agent = helper.instrumentMockedAgent(test.agent.feature_flag, test.agent.conig)
    }

    var testName = test.name
    var testFn = test.fn

    if (typeof test.initialize === 'function') {
      test.initialize(agent)
    }

    async.timesSeries(test.runs, function runTest(n, next) {
      if (global.gc && test.runGC) {
        global.gc()
      }

      if (typeof test.before === 'function') {
        test.before()
      }

      if (agent && test.runInTransaction) {
        return helper.runInTransaction(agent, function inTransaction(txn) {
          execute(txn.end.bind(txn))
        })
      }
 
      execute()

      function execute(callback) {
        var prevCpu = process.cpuUsage()
        if (test.async) {
          testFn(agent, after)
        } else {
          testFn(agent)
          after()
        }
        function after() {
          // The cpu delta is reported in microseconds, so we turn them into milliseconds
          var delta = process.cpuUsage(prevCpu).user / 1000
          if (typeof callback === 'function') {
            return callback(afterCallback)
          }
          afterCallback()
          function afterCallback() {
            next(null, delta)
          }
        }
      }
    }, function afterTestRuns(err, samples) {
      if (agent) {
        helper.unloadAgent(agent)
      }

      suite.samples[testName] = samples
      callback()
    })
  }, function onSuiteFinish() {
    if (typeof cb === 'function') {
      return cb(samples)
    } else {
      return suite.print()
    }
  })
}

class BenchmarkStats {
  constructor(samples) {
    if (samples.length < 1) {
      throw new Error('BenchmarkStats requires additional samples')
    }

    var sortedSamples = samples.slice().sort((a, b) => a - b)

    // Throw out the top 0.1% to cut down on very large anomalies
    sortedSamples = sortedSamples.slice(0, Math.floor(samples.length * 0.999))

    this.numSamples = sortedSamples.length
    var sum = 0
    var sumOfSquares = 0
    sortedSamples.forEach((sample) => {
      sum += sample
      sumOfSquares += sample * sample
    })


    this.mean = sum / this.numSamples
    this.stdDev = Math.sqrt(sumOfSquares / this.numSamples - this.mean * this.mean)
    this.max = sortedSamples[sortedSamples.length - 1]
    this.min = sortedSamples[0]
    this['5thPercentile'] = sortedSamples[Math.floor(samples.length * 0.05)]
    this['95thPercentile'] = sortedSamples[Math.floor(samples.length * 0.95)]
    this.median = sortedSamples[Math.floor(samples.length * 0.5)]
  }
}
