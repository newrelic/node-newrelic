/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const a = require('async')
const chai = require('chai')
const expect = chai.expect
const should = chai.should()
const helper = require('../lib/agent_helper')
const configurator = require('../../lib/config')
const TraceAggregator = require('../../lib/transaction/trace/aggregator')
const Transaction = require('../../lib/transaction')

describe('TraceAggregator', function () {
  let agent = null

  function createTransaction(name, duration, synth) {
    const transaction = new Transaction(agent)
    // gotta create the trace
    transaction.trace.setDurationInMillis(duration)
    transaction.url = name
    transaction.name = 'WebTransaction/Uri' + name
    transaction.statusCode = 200

    if (synth) {
      transaction.syntheticsData = {
        version: 1,
        accountId: 357,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }
    }

    return transaction.end()
  }

  beforeEach(function () {
    agent = helper.loadMockedAgent({ run_id: 1337 })
    agent.collector._runLifecycle = (remote, payload, cb) => {
      setImmediate(cb, null, [], { return_value: [] })
    }
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  it('should require a configuration at startup time', function () {
    expect(() => new TraceAggregator()).to.throw()
    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true
      }
    })

    expect(() => new TraceAggregator({ config })).to.not.throw()
  })

  it("shouldn't collect a trace if the tracer is disabled", function () {
    agent.config.transaction_tracer.enabled = false
    const tx = createTransaction('/test', 3000)
    agent.traces.add(tx)
    expect(agent.traces.trace).to.not.exist
  })

  it("shouldn't collect a trace if collect_traces is false", function () {
    agent.config.collect_traces = false
    const tx = createTransaction('/test', 3000)
    agent.traces.add(tx)
    expect(agent.traces.trace).to.not.exist
  })

  it('should let the agent decide whether to ignore a transaction', function () {
    const transaction = new Transaction(agent)
    transaction.trace.setDurationInMillis(3000)
    transaction.ignore = true

    agent.traces.add(transaction)
    should.exist(agent.traces.trace)
  })

  describe('with top n support', function () {
    let config

    beforeEach(function () {
      config = configurator.initialize({
        transaction_tracer: {
          enabled: true
        }
      })
    })

    it('should set n from its configuration', function () {
      const TOP_N = 21
      config.transaction_tracer.top_n = TOP_N
      const aggregator = new TraceAggregator({ config })

      expect(aggregator.capacity).equal(TOP_N)
    })

    it('should track the top 20 slowest transactions if top_n is unconfigured', () => {
      const aggregator = new TraceAggregator({ config })

      expect(aggregator.capacity).equal(20)
    })

    it('should track the slowest transaction in a harvest period if top_n is 0', () => {
      config.transaction_tracer.top_n = 0
      const aggregator = new TraceAggregator({ config })

      expect(aggregator.capacity).equal(1)
    })

    it('should only save a trace for an existing name if new one is slower', () => {
      const URI = '/simple'
      const aggregator = new TraceAggregator({ config })
      aggregator.reported = 10 // needed to override "first 5"

      aggregator.add(createTransaction(URI, 3000))
      aggregator.add(createTransaction(URI, 2100))
      expect(aggregator.requestTimes).to.have.property('WebTransaction/Uri/simple', 3000)
      aggregator.add(createTransaction(URI, 4000))
      expect(aggregator.requestTimes).to.have.property('WebTransaction/Uri/simple', 4000)
    })

    it('should only track transactions for the top N names', function (done) {
      agent.config.transaction_tracer.top_n = 5
      agent.traces.capacity = 5
      agent.traces.reported = 10 // needed to override "first 5"

      // Add 6 traces. The 6th one should not get added to cached times.
      a.timesSeries(
        6,
        (n, cb) => {
          expect(agent.traces.trace, 'trace before creation').to.not.exist
          createTransaction(`/test-${n}`, 8000)
          if (n !== 5) {
            expect(agent.traces.trace, `trace ${n} to be collected`).to.exist
          } else {
            expect(agent.traces.trace, 'trace 5 collected').to.not.exist
          }
          agent.traces.once('finished transaction_sample_data data send.', cb)
          agent.traces.send()
          expect(agent.traces.trace, 'trace after harvest').to.not.exist
        },
        (err) => {
          expect(err).to.not.exist

          const times = agent.traces.requestTimes
          expect(times).to.have.property('WebTransaction/Uri/test-0', 8000)
          expect(times).to.have.property('WebTransaction/Uri/test-1', 8000)
          expect(times).to.have.property('WebTransaction/Uri/test-2', 8000)
          expect(times).to.have.property('WebTransaction/Uri/test-3', 8000)
          expect(times).to.have.property('WebTransaction/Uri/test-4', 8000)
          expect(times).to.not.have.property('WebTransaction/Uri/test-5')

          done()
        }
      )
    })
  })

  it('should collect traces when the threshold is 0', function () {
    const config = configurator.initialize({
      transaction_tracer: {
        transaction_threshold: 0,
        enabled: true,
        top_n: 10
      }
    })

    const aggregator = new TraceAggregator({ config })
    const transaction = new Transaction(agent)

    transaction.trace.setDurationInMillis(0)
    transaction.url = '/test'
    transaction.name = 'WebTransaction/Uri/test'
    transaction.statusCode = 200

    aggregator.add(transaction)
    expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(0)
  })

  it('should collect traces for transactions that exceed apdex_f', function () {
    const ABOVE_THRESHOLD = 29
    const APDEXT = 0.007

    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true,
        top_n: 10
      }
    })

    const aggregator = new TraceAggregator({ config })
    const transaction = new Transaction(agent)

    aggregator.reported = 10 // needed to override "first 5"

    // let's violating Law of Demeter!
    transaction.metrics.apdexT = APDEXT
    transaction.trace.setDurationInMillis(ABOVE_THRESHOLD)
    transaction.url = '/test'
    transaction.name = 'WebTransaction/Uri/test'
    transaction.statusCode = 200

    aggregator.add(transaction)
    expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(ABOVE_THRESHOLD)
  })

  it("should not collect traces for transactions that don't exceed apdex_f", function () {
    const BELOW_THRESHOLD = 27
    const APDEXT = 0.007

    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true,
        top_n: 10
      }
    })

    const aggregator = new TraceAggregator({ config })
    const transaction = new Transaction(agent)

    aggregator.reported = 10 // needed to override "first 5"

    // let's violating Law of Demeter!
    transaction.metrics.apdexT = APDEXT
    transaction.trace.setDurationInMillis(BELOW_THRESHOLD)
    transaction.url = '/test'
    transaction.name = 'WebTransaction/Uri/test'
    transaction.statusCode = 200

    aggregator.add(transaction)
    expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(undefined)
  })

  it('should collect traces that exceed explicit trace threshold', () => {
    const ABOVE_THRESHOLD = 29
    const THRESHOLD = 0.028

    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true,
        transaction_threshold: THRESHOLD
      }
    })

    const aggregator = new TraceAggregator({ config })
    aggregator.reported = 10 // needed to override "first 5"
    const tx = createTransaction('/test', ABOVE_THRESHOLD)
    aggregator.add(tx)

    expect(aggregator.requestTimes).to.have.property('WebTransaction/Uri/test', ABOVE_THRESHOLD)
  })

  it('should not collect traces that do not exceed trace threshold', () => {
    const BELOW_THRESHOLD = 29
    const THRESHOLD = 30

    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true,
        transaction_threshold: THRESHOLD
      }
    })

    const aggregator = new TraceAggregator({ config })
    aggregator.reported = 10 // needed to override "first 5"
    const tx = createTransaction('/test', BELOW_THRESHOLD)
    aggregator.add(tx)
    expect(aggregator.requestTimes).to.not.have.property('WebTransaction/Uri/test')
  })

  it('should group transactions by the metric name associated with them', () => {
    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true,
        top_n: 10
      }
    })

    const aggregator = new TraceAggregator({ config })

    const tx = createTransaction('/test', 2100)
    aggregator.add(tx)
    expect(aggregator.requestTimes).to.have.property('WebTransaction/Uri/test', 2100)
  })

  it('should always report slow traces until 5 have been sent', function (done) {
    agent.config.apdex_t = 0
    agent.config.run_id = 1337
    agent.config.transaction_tracer.enabled = true

    // Go through 5 transactions. Note that the names of the transactions must
    // repeat!
    a.timesSeries(
      5,
      (n, cb) => {
        expect(agent.traces.trace, 'trace waiting to be collected').to.not.exist
        createTransaction(`/test-${n % 3}`, 500)
        expect(agent.traces.trace, `${n}th trace to collect`).to.exist
        agent.traces.once('finished transaction_sample_data data send.', cb)
        agent.traces.send()
      },
      (err) => {
        expect(err).to.not.exist

        // This 6th transaction should not be collected.
        expect(agent.traces.trace).to.not.exist
        createTransaction(`/test-0`, 500)
        expect(agent.traces.trace, '6th trace to collect').to.not.exist
        done()
      }
    )
  })

  describe('when request timings are tracked over time', function () {
    it('should reset timings after 5 harvest cycles with no slow traces', (done) => {
      agent.config.run_id = 1337
      agent.config.transaction_tracer.enabled = true

      const aggregator = agent.traces
      const tx = createTransaction('/test', 5030)
      aggregator.add(tx)

      let remaining = 4
      // 2nd-5th harvests: no serialized trace, timing still set
      const looper = function () {
        expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(5030)
        aggregator.clear()

        remaining--
        if (remaining < 1) {
          // 6th harvest: no serialized trace, timings reset
          agent.traces.once('finished transaction_sample_data data send.', function () {
            expect(aggregator.requestTimes).to.not.have.property('WebTransaction/Uri/test')

            done()
          })
          agent.traces.send()
        } else {
          agent.traces.once('finished transaction_sample_data data send.', looper)
          agent.traces.send()
        }
      }

      aggregator.add(tx)

      agent.traces.once('finished transaction_sample_data data send.', function () {
        expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(5030)
        aggregator.clear()

        agent.traces.once('finished transaction_sample_data data send.', looper)
        agent.traces.send()
      })
      agent.traces.send()
    })
  })

  it('should reset the syntheticsTraces when resetting trace', function () {
    agent.config.transaction_tracer.enabled = true

    const aggregator = agent.traces
    createTransaction('/testOne', 503)
    expect(aggregator.trace).to.exist
    aggregator.clear()

    createTransaction('/testTwo', 406, true)
    expect(aggregator.trace).to.not.exist
    expect(aggregator.syntheticsTraces).to.have.length(1)

    aggregator.clear()
    expect(aggregator.syntheticsTraces).to.have.length(0)
  })
})
