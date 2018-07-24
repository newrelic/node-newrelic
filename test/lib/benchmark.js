'use strict'

var benchmark = require('benchmark')
var copy = require('../../lib/util/copy')
var helper = require('./agent_helper')


exports.createBenchmark = function createBenchmark(opts) {
  return new Benchmark(opts)
}

function Benchmark(opts) {
  this.name = opts.name || "Anonymous Suite"
  this.numRuns = opts.runs || 1000
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
  return this.processedSamples = Object.keys(samples).map((sampleName) => {
    return [
      sampleName,
      new BenchmarkStats(samples[sampleName].map((sampleObj) => sampleObj.user))
    ]
  }).reduce((acc, samplePair) => {
    acc[samplePair[0]] = samplePair[1]
    return acc
  }, {})
}

Benchmark.prototype.print = function print() {
  console.log(JSON.stringify(this.processSamples(), null, 2))
}

Benchmark.prototype.run = function run(cb) {
  var tests = this.tests
  var samples = this.samples
  var numSamples = this.numRuns
  var delay = this.delay
  var suite = this
  var agent = null

  setImmediate(createRunner(0))

  function createRunner(testIdx) {
    // Clean up last test, if needed
    if (agent) {
      helper.unloadAgent(agent)
    }

    if (testIdx === tests.length) {
      return function() {
        if (typeof cb === 'function') {
          return cb(samples)
        } else {
          return suite.print()
        }
      }
    }

    var numRuns = 0

    var test = tests[testIdx]
    var testName = test.name
    var testFn = test.fn
    if (test.agent) {
      agent = helper.instrumentMockedAgent(test.agent.feature_flag, test.agent.conig)
    }

    if (!samples[testName]) {
      samples[testName] = []
    }

    if (typeof test.initialize === 'function') {
      test.initialize()
    }

    return function runTest() {
      if (global.gc && test.runGC) {
        global.gc()
      }

      if (typeof test.before === 'function') {
        test.before()
      }

      var prevCpu = process.cpuUsage()
      if (test.async) {
        var res = testFn(agent, after)
      } else {
        testFn(agent)
        after()
      }
      function after() {
        samples[testName].push(process.cpuUsage(prevCpu))
        var delta = process.cpuUsage(prevCpu)
        samples[testName].push(delta)
        if (++numRuns < numSamples) {
          setImmediate(runTest, delay)
        } else {
          setImmediate(createRunner(++testIdx))
        }
      }
    }
  }
}

class BenchmarkStats {
  constructor(samples) {
    if (samples.length < 1) {
      throw new Error('BenchmarkStats requires additional samples')
    }

    // TODO: remove large samples if they crack down on the standard
    // deviation (i.e. they are anomalies).
    const sortedSamples = samples.slice().sort((a, b) => a - b)
    this.max = sortedSamples[sortedSamples.length - 1]
    this.min = sortedSamples[0]
    this['5thPercentile'] = sortedSamples[Math.floor(samples.length * 0.05)]
    this['95thPercentile'] = sortedSamples[Math.floor(samples.length * 0.95)]
    this.median = sortedSamples[Math.floor(samples.length * 0.5)]
    var sum = 0
    var sumOfSquares = 0
    this.numSamples = samples.length
    samples.forEach((sample) => {
      sum += sample
      sumOfSquares += sample * sample
    })
    this.mean = sum / this.numSamples
    this.stdDev = Math.sqrt(sumOfSquares / this.numSamples - this.mean * this.mean)
  }
}
