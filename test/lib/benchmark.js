/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('./agent_helper')

exports.createBenchmark = (opts) => {
  return new Benchmark(opts)
}

class Benchmark {
  constructor(opts) {
    this.name = opts.name || 'Anonymous Suite'
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

  add(opts) {
    opts = Object.assign({}, this.opts, opts)
    this.tests.push(opts)
  }

  processSamples() {
    const samples = this.samples
    return (this.processedSamples = Object.keys(samples).reduce((acc, sampleName) => {
      try {
        acc[sampleName] = new BenchmarkStats(samples[sampleName], this.name, sampleName)
        return acc
      } catch (e) {
        /* eslint-disable no-console */
        console.error(e)
      }
    }, {}))
  }

  print() {
    console.log(JSON.stringify(this.processSamples(), null, 2)) // eslint-disable-line
  }

  async run() {
    const suite = this
    let agent = null

    const after = async (test, next, executeCb, prevCpu) => {
      // The cpu delta is reported in microseconds, so we turn them into
      // milliseconds
      const delta = process.cpuUsage(prevCpu).user / 1000
      const afterCallback = () => next(null, delta) // still sending this to callbackistan

      if (typeof test.after === 'function') {
        test.after()
      }

      if (typeof executeCb === 'function') {
        return executeCb(afterCallback)
      }

      return afterCallback()
    }

    const execute = async (test, next, executeCb) => {
      const prevCpu = process.cpuUsage()
      const testFn = test.fn

      if (test.async) {
        return testFn(agent, () => after(test, next, executeCb, prevCpu))
      }
      await testFn(agent)
      return after(test, next, executeCb, prevCpu)
    }

    const runTest = async (n, test, next) => {
      if (global.gc && test.runGC) {
        global.gc()
      }

      if (typeof test.before === 'function') {
        test.before(agent)
      }

      if (agent && test.runInTransaction) {
        const inTransaction = (txn) => {
          const afterExecute = (execCallback) => {
            txn.end()
            return execCallback(txn)
          }
          return execute(test, next, afterExecute)
        }

        return helper.runInTransaction(agent, inTransaction)
      }

      return execute(test, next)
    }

    const testIterator = async (initiator, idx) => {
      if (idx >= suite.tests.length) {
        return true
      }
      return initiator(initiator, suite.tests[idx], idx)
    }

    const afterTestRuns = (initiator, test, samples, idx) => {
      const testName = test.name

      if (agent) {
        helper.unloadAgent(agent)
      }

      if (typeof test.teardown === 'function') {
        test.teardown()
      }

      suite.samples[testName] = samples
      return testIterator(initiator, idx + 1)
    }

    const startTest = async (initiator, test, idx) => {
      if (test.agent) {
        agent = helper.instrumentMockedAgent(test.agent.config)
      }

      if (typeof test.initialize === 'function') {
        test.initialize(agent)
      }

      const samples = []
      for (let i = 0; i < test.runs; i++) {
        await runTest(i, test, (err, delta) => {
          samples.push(delta)
        }) // reliant on callback; should refactor test simply to return delta
      }

      return afterTestRuns(initiator, test, samples, idx)
    }

    await testIterator(startTest, 0) // passing startTest as initiator to avoid circular dependency
    const onSuiteFinish = () => suite.print()
    onSuiteFinish()
  }
}

class BenchmarkStats {
  constructor(samples, testName, sampleName) {
    if (samples.length < 1) {
      console.log(`BenchmarkStats for ${testName} has no samples. SampleName: ${sampleName}`)
      throw new Error('BenchmarkStats requires more than zero samples')
    }

    let sortedSamples = samples.slice().sort((a, b) => a - b)

    // Throw out the top 0.1% to cut down on very large anomalies
    sortedSamples = sortedSamples.slice(0, Math.floor(samples.length * 0.999))

    this.numSamples = sortedSamples.length
    let sum = 0
    let sumOfSquares = 0
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
