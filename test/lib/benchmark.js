/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('./agent_helper')

exports.createBenchmark = (opts) => {
  return new Benchmark(opts)
}

/**
 * Represents the benchmark test; created in test/benchmark/*.bench.js files
 * @class
 * @param {Object} opts test suite configuration options
 * @param {string} [opts.name='Anonymous Suite'] name of test suite
 * @param {number} [opts.runs=1000] number of test iterations to run
 */
class Benchmark {
  constructor(opts) {
    this.name = opts.name || 'Anonymous Suite'
    if (!opts.runs) {
      opts.runs = 1000
    }
    this.opts = opts

    // Aggregation collections
    this.tests = []
    this.samples = {}
    this.processedSamples = {}
  }

  /**
   * Adds a test to the suite in a *.bench.js file
   * @param {Object} opts benchmark test configuration options
   * @param {string} opts.name name of benchmark test in the suite
   * @param {function} opts.fn A function invoking the agent method or behavior that is the target of the test.
   *   Depending on what the test requires, this function can return a function invocation (see `events/span-event.bench.js`,
   *   or `shim` `is<Type>` tests), an object defining functions to test (see `shim/wrapped.bench.js`), a promise (see
   *   many tests in `datastore-shim`), or have no return value at all, being used for its side effects (see
   *   `events/merge.bench.js`).
   *
   *   In its simplest form, the function supplied to `fn` could execute an agent method synchronously, and this framework
   *   will measure its performance. Any necessary configuration can be handled in the function body. Similar code can be
   *   shared between tests in imported files. (See the `shim` directory's `shared.js` for an example.
   *
   *   Any precondition or post-test cleanup can be handled in before/after or initialize/ teardown parameters.
   * @param {function} [opts.initialize] Executed before tests run, to instantiate resources used by the test suite.
   *   The function supplied to `initialize` could return a promise (as with `createServer` in `http`), it can also *not* return
   *   anything, instead using side effects to create resources (see `makeInit` in `datastore-shim`) or fill queues (see
   *   the anonymous for loop in `events`).
   * @param {function} [opts.teardown] Executed after the tests run, typically to clean up resources or listeners.
   *   This could return a promise or function invocation. See `closeServer` in `http` for an example.
   * @param {function} [opts.before] Executed before each test run. This could return a value--for example, see
   *   the `shim/shared.js` function `getTest`, which is returned by the `before` properties in `shim/wrapped.bench.js`
   *   tests, after some pre-test configuration. In other cases, such as `shim/merged.bench.js`, `before` is used to fill
   *   queues shared by the tests, and there is no returned value--it's used only to produce side effects.
   * @param {function} [opts.after] Executed after each test run to reset any changes to test resources. This does not
   *   need to return any value. See `metrics/getOrCreateMetric.js`, `async-hooks.bench.js`, or `events/merge.bench.js`
   * @param {Object} [opts.agent] agent configuration object, or a configured agent
   * @param {boolean} [opts.runInTransaction] if the agent code path under test must be run in a transaction, set to true.
   * @param {boolean} [opts.runGC] if GC should be run before each test, set to true
   */
  add(opts) {
    opts = Object.assign({}, this.opts, opts)
    this.tests.push(opts)
  }

  /**
   * Processes each property of the `samples` object to reduce them to stats
   * @returns {BenchmarkStats} object representing statistical analysis of samples
   */
  processSamples() {
    const samples = this.samples
    this.processedSamples = Object.keys(samples).reduce((acc, sampleName) => {
      try {
        acc[sampleName] = new BenchmarkStats(samples[sampleName], this.name, sampleName)
        return acc
      } catch (e) {
        console.error(e)
      }
      return undefined
    }, {})
    return this.processedSamples
  }

  /**
   * Last step of the test: this prints the processed stats as a string to stdout
   */
  print() {
    console.log(JSON.stringify(this.processSamples(), null, 2))
  }

  /**
   * This function is called from the /test/benchmark/*.bench.js test files.
   * Once a suite is created and tests added, `suite.run()` begins the test
   */
  async run() {
    const suite = this
    let agent = null

    /**
     * Function that calculates CPU usage after a test, and calls any defined after/callback
     * @param {Object} test Object defining the current test configuration
     * @param {function} next anonymous function defined in the `startTest` for loop;
     *   its second parameter is the delta between the current CPU usage and the previous CPU usage.
     * @param {?function} [executeCb] If the test is run in a transaction, `executeCb` is defined,
     *   and will run after any user-defined `after` function. If `executeCb` is defined, the result of
     *   that is the `after` function's return value.
     * @param {{user: number, system: number}} prevCpu Output of process.cpuUsage() in the previous test
     * @returns {function} an invocation of `executeCb`, if defined, or `next(null, delta)`
     */
    const after = async (test, next, executeCb, prevCpu) => {
      // The cpu delta is reported in microseconds, so we turn them into
      // milliseconds
      const delta = process.cpuUsage(prevCpu).user / 1000
      // Despite an effort to reduce callbacks in this test class, some remain, like this one:
      const afterCallback = () => next(null, delta)

      if (typeof test.after === 'function') {
        test.after()
      }

      if (typeof executeCb === 'function') {
        return executeCb(afterCallback)
      }

      return afterCallback()
    }

    /**
     * `execute` gets the CPU usage prior to the test and runs the test.
     * @param {Object} test configuration for the test, including the function to be tested
     * @param {function} next anonymous function defined in the `startTest` for loop;
     *   its second parameter is the delta between the current CPU usage and the previous CPU usage.
     * @param {function} [executeCb] If the test is run in a transaction, `executeCb` is defined,
     *   and will run after any user-defined `after` function. If `executeCb` is defined, the result of
     *   that is the `after` function's return value.
     * @returns {function} an invocation of the `after` function
     */
    const execute = async (test, next, executeCb) => {
      const prevCpu = process.cpuUsage()
      const testFn = test.fn

      await testFn(agent)
      return after(test, next, executeCb, prevCpu)
    }

    /**
     * `runTest` performs one execution of a benchmark test
     * @param {number} n Index of the test in the sequence of tests to be run
     * @param {object} test Test configuration as defined in the *.bench.js file for this suite
     * @param {function} next anonymous function defined in the `startTest` for loop;
     *   its second parameter is the delta between the current CPU usage and the previous CPU usage.
     * @returns {function} If this test is run in a transaction, this returns an invocation of
     *    helper.runInTransaction. Otherwise, this returns an invocation of `execute`.
     */
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

    /**
     *
     * @param {function} initiator Function to begin the test process--`startTest`
     * @param {number} idx Index of the current test run
     * @returns {Promise<*|boolean>} resolves to the return value of the recursive chain of
     *   initiators (`startTest`) and returned functions (`afterTestRuns`)
     */
    const testIterator = async (initiator, idx) => {
      if (idx >= suite.tests.length) {
        return true
      }
      return await initiator(initiator, suite.tests[idx], idx)
    }

    /**
     *
     * @param {function} initiator The test runner `startTest`
     * @param {object} test configuration for the test
     * @param {Array} samples Array of the CPU deltas from this test
     * @param {number} idx Index of the current test run
     * @returns {function} The next instance in the recursive chain of initiators (`startTest`)
     *   and returned functions (`afterTestRuns`)
     */
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

    /**
     * `startTest` begins the suite of tests, passing its initiator argument to subsequent tests.
     * @param {function} initiator Sets up and executes tests, and is passed to the
     *   afterTestRuns function to be passed on to subsequent tests
     * @param {object} test Configuration object for this suite's test
     * @param {number} idx Integer for tracking progress through the recursive tests
     * @returns {function} invocation of `afterTestRuns`, which continues the chain of recursion.
     */
    const startTest = async (initiator, test, idx) => {
      if (test.agent) {
        agent = helper.instrumentMockedAgent(test.agent.config)
      }

      if (typeof test.initialize === 'function') {
        await test.initialize(agent)
      }

      const samples = []
      for (let i = 0; i < test.runs; i++) {
        await runTest(i, test, (_, delta) => {
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

/**
 * Class representing the statistical analysis of the benchmark test runs
 * @class
 * @param {Array} samples Array of deltas of CPU performances
 * @param {string} testName Name of this test
 * @param {string} sampleName Name of the kind of test sample being run. This is displayed only if
 *   the test produces no samples--likely an indicator of a benchmark test returning before tests
 *   have finished.
 */
class BenchmarkStats {
  constructor(samples, testName, sampleName) {
    if (samples.length < 1) {
      throw new Error(`BenchmarkStats for ${testName} has no samples. SampleName: ${sampleName}`)
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
