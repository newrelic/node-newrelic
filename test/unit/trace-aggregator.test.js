/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const helper = require('../lib/agent_helper')
const configurator = require('../../lib/config')
const TraceAggregator = require('../../lib/transaction/trace/aggregator')
const Transaction = require('../../lib/transaction')

function createTransaction(agent, name, duration, synth) {
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

function beforeEach(t) {
  const agent = helper.loadMockedAgent({ run_id: 1337 })
  agent.collector._runLifecycle = (remote, payload, cb) => {
    setImmediate(cb, null, [], { return_value: [] })
  }
  t.context.agent = agent
}

function afterEach(t) {
  helper.unloadAgent(t.context.agent)
}

tap.test('TraceAggregator', function (t) {
  t.autoend()

  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  t.test('should require a configuration at startup time', function (t) {
    t.throws(() => new TraceAggregator())
    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true
      }
    })

    t.doesNotThrow(() => new TraceAggregator({ config }))
    t.end()
  })

  t.test("shouldn't collect a trace if the tracer is disabled", function (t) {
    const { agent } = t.context
    agent.config.transaction_tracer.enabled = false
    const tx = createTransaction(agent, '/test', 3000)
    agent.traces.add(tx)
    t.notOk(agent.traces.trace)
    t.end()
  })

  t.test("shouldn't collect a trace if collect_traces is false", function (t) {
    const { agent } = t.context
    agent.config.collect_traces = false
    const tx = createTransaction(agent, '/test', 3000)
    agent.traces.add(tx)
    t.notOk(agent.traces.trace)
    t.end()
  })

  t.test('should let the agent decide whether to ignore a transaction', function (t) {
    const { agent } = t.context
    const transaction = new Transaction(agent)
    transaction.trace.setDurationInMillis(3000)
    transaction.ignore = true

    agent.traces.add(transaction)
    t.ok(agent.traces.trace)
    t.end()
  })

  t.test('should collect traces when the threshold is 0', function (t) {
    const { agent } = t.context
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
    t.equal(aggregator.requestTimes['WebTransaction/Uri/test'], 0)
    t.end()
  })

  t.test('should collect traces for transactions that exceed apdex_f', function (t) {
    const { agent } = t.context
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
    t.equal(aggregator.requestTimes['WebTransaction/Uri/test'], ABOVE_THRESHOLD)
    t.end()
  })

  t.test("should not collect traces for transactions that don't exceed apdex_f", function (t) {
    const { agent } = t.context
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
    t.equal(aggregator.requestTimes['WebTransaction/Uri/test'], undefined)
    t.end()
  })

  t.test('should collect traces that exceed explicit trace threshold', (t) => {
    const { agent } = t.context
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
    const tx = createTransaction(agent, '/test', ABOVE_THRESHOLD)
    aggregator.add(tx)

    t.equal(aggregator.requestTimes['WebTransaction/Uri/test'], ABOVE_THRESHOLD)
    t.end()
  })

  t.test('should not collect traces that do not exceed trace threshold', (t) => {
    const { agent } = t.context
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
    const tx = createTransaction(agent, '/test', BELOW_THRESHOLD)
    aggregator.add(tx)
    t.notOk(aggregator.requestTimes['WebTransaction/Uri/test'])
    t.end()
  })

  t.test('should group transactions by the metric name associated with them', (t) => {
    const { agent } = t.context
    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true,
        top_n: 10
      }
    })

    const aggregator = new TraceAggregator({ config })

    const tx = createTransaction(agent, '/test', 2100)
    aggregator.add(tx)
    t.equal(aggregator.requestTimes['WebTransaction/Uri/test'], 2100)
    t.end()
  })

  t.test('should always report slow traces until 5 have been sent', function (t) {
    const { agent } = t.context
    agent.config.apdex_t = 0
    agent.config.run_id = 1337
    agent.config.transaction_tracer.enabled = true
    const maxTraces = 5

    // Go through 5 transactions. Note that the names of the transactions must
    // repeat!

    const txnCreator = (n, max, cb) => {
      t.notOk(agent.traces.trace, 'trace waiting to be collected')
      createTransaction(agent, `/test-${n % 3}`, 500)
      t.ok(agent.traces.trace, `${n}th trace to collect`)
      agent.traces.once('finished transaction_sample_data data send.', (err) =>
        cb(err, { idx: n, max })
      )
      agent.traces.send()
    }

    const finalCallback = (err) => {
      t.error(err)
      // This 6th transaction should not be collected.
      t.notOk(agent.traces.trace)
      createTransaction(agent, `/test-0`, 500)
      t.notOk(agent.traces.trace, '6th trace to collect')
      t.end()
    }

    // Array iteration is too difficult to slow down, so this steps through recursively
    txnCreator(0, maxTraces, function testCallback(err, props) {
      t.error(err)
      const { idx, max } = props
      const nextIdx = idx + 1
      if (nextIdx >= max) {
        return finalCallback()
      }
      return txnCreator(nextIdx, max, testCallback)
    })
  })

  t.test('should reset timings after 5 harvest cycles with no slow traces', (t) => {
    const { agent } = t.context
    agent.config.run_id = 1337
    agent.config.transaction_tracer.enabled = true

    const aggregator = agent.traces
    const tx = createTransaction(agent, '/test', 5030)
    aggregator.add(tx)

    let remaining = 4
    // 2nd-5th harvests: no serialized trace, timing still set
    const looper = function () {
      t.equal(aggregator.requestTimes['WebTransaction/Uri/test'], 5030)
      aggregator.clear()

      remaining--
      if (remaining < 1) {
        // 6th harvest: no serialized trace, timings reset
        agent.traces.once('finished transaction_sample_data data send.', function () {
          t.notOk(aggregator.requestTimes['WebTransaction/Uri/test'])

          t.end()
        })
        agent.traces.send()
      } else {
        agent.traces.once('finished transaction_sample_data data send.', looper)
        agent.traces.send()
      }
    }

    aggregator.add(tx)

    agent.traces.once('finished transaction_sample_data data send.', function () {
      t.equal(aggregator.requestTimes['WebTransaction/Uri/test'], 5030)
      aggregator.clear()

      agent.traces.once('finished transaction_sample_data data send.', looper)
      agent.traces.send()
    })
    agent.traces.send()
  })

  t.test('should reset the syntheticsTraces when resetting trace', function (t) {
    const { agent } = t.context
    agent.config.transaction_tracer.enabled = true

    const aggregator = agent.traces
    createTransaction(agent, '/testOne', 503)
    t.ok(aggregator.trace)
    aggregator.clear()

    createTransaction(agent, '/testTwo', 406, true)
    t.notOk(aggregator.trace)
    t.equal(aggregator.syntheticsTraces.length, 1)

    aggregator.clear()
    t.equal(aggregator.syntheticsTraces.length, 0)
    t.end()
  })
})

tap.test('TraceAggregator with top n support', function (t) {
  t.autoend()
  t.beforeEach(function () {
    beforeEach(t)
    t.context.config = configurator.initialize({
      transaction_tracer: {
        enabled: true
      }
    })
  })

  t.afterEach(afterEach)

  t.test('should set n from its configuration', function (t) {
    const { config } = t.context
    const TOP_N = 21
    config.transaction_tracer.top_n = TOP_N
    const aggregator = new TraceAggregator({ config })

    t.equal(aggregator.capacity, TOP_N)
    t.end()
  })

  t.test('should track the top 20 slowest transactions if top_n is unconfigured', (t) => {
    const { config } = t.context
    const aggregator = new TraceAggregator({ config })

    t.equal(aggregator.capacity, 20)
    t.end()
  })

  t.test('should track the slowest transaction in a harvest period if top_n is 0', (t) => {
    const { config } = t.context
    config.transaction_tracer.top_n = 0
    const aggregator = new TraceAggregator({ config })

    t.equal(aggregator.capacity, 1)
    t.end()
  })

  t.test('should only save a trace for an existing name if new one is slower', (t) => {
    const { config, agent } = t.context
    const URI = '/simple'
    const aggregator = new TraceAggregator({ config })
    aggregator.reported = 10 // needed to override "first 5"

    aggregator.add(createTransaction(agent, URI, 3000))
    aggregator.add(createTransaction(agent, URI, 2100))
    t.equal(aggregator.requestTimes['WebTransaction/Uri/simple'], 3000)
    aggregator.add(createTransaction(agent, URI, 4000))
    t.equal(aggregator.requestTimes['WebTransaction/Uri/simple'], 4000)
    t.end()
  })

  t.test('should only track transactions for the top N names', function (t) {
    const { agent } = t.context
    agent.config.transaction_tracer.top_n = 5
    agent.traces.capacity = 5
    agent.traces.reported = 10 // needed to override "first 5"
    const maxTraces = 6

    const txnCreator = (n, max, cb) => {
      t.notOk(agent.traces.trace, 'trace before creation')
      createTransaction(agent, `/test-${n}`, 8000)
      if (n !== 5) {
        t.ok(agent.traces.trace, `trace ${n} to be collected`)
      } else {
        t.notOk(agent.traces.trace, 'trace 5 collected')
      }
      agent.traces.once('finished transaction_sample_data data send.', (err) =>
        cb(err, { idx: n, max })
      )
      agent.traces.send()
      t.notOk(agent.traces.trace, 'trace after harvest')
      if (n === 5) {
        t.end()
      }
    }
    const finalCallback = (err) => {
      t.error(err)

      const times = agent.traces.requestTimes
      t.equal(times['WebTransaction/Uri/test-0'], 8000)
      t.equal(times['WebTransaction/Uri/test-1'], 8000)
      t.equal(times['WebTransaction/Uri/test-2'], 8000)
      t.equal(times['WebTransaction/Uri/test-3'], 8000)
      t.equal(times['WebTransaction/Uri/test-4'], 8000)
      t.notOk(times['WebTransaction/Uri/test-5'])
    }

    const testCallback = (err, props) => {
      t.error(err)
      const { idx, max } = props
      const nextIdx = idx + 1
      if (nextIdx >= max) {
        return finalCallback()
      }
      return txnCreator(nextIdx, max, testCallback)
    }

    // Step through recursively
    txnCreator(0, maxTraces, testCallback)
  })
})
