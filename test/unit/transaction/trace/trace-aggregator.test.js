/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../../lib/agent_helper')
const configurator = require('../../../../lib/config')
const TraceAggregator = require('../../../../lib/transaction/trace/aggregator')
const Transaction = require('../../../../lib/transaction')

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

function beforeEach(ctx) {
  ctx.nr = {}
  const agent = helper.loadMockedAgent({ run_id: 1337 })
  agent.collector._runLifecycle = (remote, payload, cb) => {
    setImmediate(cb, null, [], { return_value: [] })
  }
  ctx.nr.agent = agent
}

function afterEach(ctx) {
  helper.unloadAgent(ctx.nr.agent)
}

test('TraceAggregator', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('should require a configuration at startup time', function (t) {
    const { agent } = t.nr
    assert.throws(() => new TraceAggregator())
    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true
      }
    })

    assert.doesNotThrow(() => new TraceAggregator({ config }, agent.collector, agent.harvester))
  })

  await t.test("shouldn't collect a trace if the tracer is disabled", function (t) {
    const { agent } = t.nr
    agent.config.transaction_tracer.enabled = false
    const tx = createTransaction(agent, '/test', 3000)
    agent.traces.add(tx)
    assert.ok(!agent.traces.trace)
  })

  await t.test("shouldn't collect a trace if collect_traces is false", function (t) {
    const { agent } = t.nr
    agent.config.collect_traces = false
    const tx = createTransaction(agent, '/test', 3000)
    agent.traces.add(tx)
    assert.ok(!agent.traces.trace)
  })

  await t.test('should let the agent decide whether to ignore a transaction', function (t) {
    const { agent } = t.nr
    const transaction = new Transaction(agent)
    transaction.trace.setDurationInMillis(3000)
    transaction.ignore = true

    agent.traces.add(transaction)
    assert.ok(agent.traces.trace)
  })

  await t.test('should collect traces when the threshold is 0', function (t) {
    const { agent } = t.nr
    const config = configurator.initialize({
      transaction_tracer: {
        transaction_threshold: 0,
        enabled: true,
        top_n: 10
      }
    })

    const aggregator = new TraceAggregator({ config }, agent.collector, agent.harvester)
    const transaction = new Transaction(agent)

    transaction.trace.setDurationInMillis(0)
    transaction.url = '/test'
    transaction.name = 'WebTransaction/Uri/test'
    transaction.statusCode = 200

    aggregator.add(transaction)
    assert.equal(aggregator.requestTimes['WebTransaction/Uri/test'], 0)
  })

  await t.test('should collect traces for transactions that exceed apdex_f', function (t) {
    const { agent } = t.nr
    const ABOVE_THRESHOLD = 29
    const APDEXT = 0.007

    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true,
        top_n: 10
      }
    })

    const aggregator = new TraceAggregator({ config }, agent.collector, agent.harvester)
    const transaction = new Transaction(agent)

    aggregator.reported = 10 // needed to override "first 5"

    // let's violating Law of Demeter!
    transaction.metrics.apdexT = APDEXT
    transaction.trace.setDurationInMillis(ABOVE_THRESHOLD)
    transaction.url = '/test'
    transaction.name = 'WebTransaction/Uri/test'
    transaction.statusCode = 200

    aggregator.add(transaction)
    assert.equal(aggregator.requestTimes['WebTransaction/Uri/test'], ABOVE_THRESHOLD)
  })

  await t.test(
    "should not collect traces for transactions that don't exceed apdex_f",
    function (t) {
      const { agent } = t.nr
      const BELOW_THRESHOLD = 27
      const APDEXT = 0.007

      const config = configurator.initialize({
        transaction_tracer: {
          enabled: true,
          top_n: 10
        }
      })

      const aggregator = new TraceAggregator({ config }, agent.collector, agent.harvester)
      const transaction = new Transaction(agent)

      aggregator.reported = 10 // needed to override "first 5"

      // let's violating Law of Demeter!
      transaction.metrics.apdexT = APDEXT
      transaction.trace.setDurationInMillis(BELOW_THRESHOLD)
      transaction.url = '/test'
      transaction.name = 'WebTransaction/Uri/test'
      transaction.statusCode = 200

      aggregator.add(transaction)
      assert.equal(aggregator.requestTimes['WebTransaction/Uri/test'], undefined)
    }
  )

  await t.test('should collect traces that exceed explicit trace threshold', (t) => {
    const { agent } = t.nr
    const ABOVE_THRESHOLD = 29
    const THRESHOLD = 0.028

    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true,
        transaction_threshold: THRESHOLD
      }
    })

    const aggregator = new TraceAggregator({ config }, agent.collector, agent.harvester)
    aggregator.reported = 10 // needed to override "first 5"
    const tx = createTransaction(agent, '/test', ABOVE_THRESHOLD)
    aggregator.add(tx)

    assert.equal(aggregator.requestTimes['WebTransaction/Uri/test'], ABOVE_THRESHOLD)
  })

  await t.test('should not collect traces that do not exceed trace threshold', (t) => {
    const { agent } = t.nr
    const BELOW_THRESHOLD = 29
    const THRESHOLD = 30

    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true,
        transaction_threshold: THRESHOLD
      }
    })

    const aggregator = new TraceAggregator({ config }, agent.collector, agent.harvester)
    aggregator.reported = 10 // needed to override "first 5"
    const tx = createTransaction(agent, '/test', BELOW_THRESHOLD)
    aggregator.add(tx)
    assert.ok(!aggregator.requestTimes['WebTransaction/Uri/test'])
  })

  await t.test('should group transactions by the metric name associated with them', (t) => {
    const { agent } = t.nr
    const config = configurator.initialize({
      transaction_tracer: {
        enabled: true,
        top_n: 10
      }
    })

    const aggregator = new TraceAggregator({ config }, agent.collector, agent.harvester)

    const tx = createTransaction(agent, '/test', 2100)
    aggregator.add(tx)
    assert.equal(aggregator.requestTimes['WebTransaction/Uri/test'], 2100)
  })

  await t.test('should always report slow traces until 5 have been sent', function (t, end) {
    const { agent } = t.nr
    agent.config.apdex_t = 0
    agent.config.run_id = 1337
    agent.config.transaction_tracer.enabled = true
    const maxTraces = 5

    // Go through 5 transactions. Note that the names of the transactions must
    // repeat!

    const txnCreator = (n, max, cb) => {
      assert.ok(!agent.traces.trace, 'trace waiting to be collected')
      createTransaction(agent, `/test-${n % 3}`, 500)
      assert.ok(agent.traces.trace, `${n}th trace to collect`)
      agent.traces.once('finished_data_send-transaction_sample_data', (err) => cb(err, { idx: n, max }))
      agent.traces.send()
    }

    const finalCallback = (err) => {
      assert.ok(!err)
      // This 6th transaction should not be collected.
      assert.ok(!agent.traces.trace)
      createTransaction(agent, '/test-0', 500)
      assert.ok(!agent.traces.trace, '6th trace to collect')
      end()
    }

    // Array iteration is too difficult to slow down, so this steps through recursively
    txnCreator(0, maxTraces, function testCallback(err, props) {
      assert.ok(!err)
      const { idx, max } = props
      const nextIdx = idx + 1
      if (nextIdx >= max) {
        return finalCallback()
      }
      return txnCreator(nextIdx, max, testCallback)
    })
  })

  await t.test('should reset timings after 5 harvest cycles with no slow traces', (t, end) => {
    const { agent } = t.nr
    agent.config.run_id = 1337
    agent.config.transaction_tracer.enabled = true

    const aggregator = agent.traces
    const tx = createTransaction(agent, '/test', 5030)
    aggregator.add(tx)

    let remaining = 4
    // 2nd-5th harvests: no serialized trace, timing still set
    const looper = function () {
      assert.equal(aggregator.requestTimes['WebTransaction/Uri/test'], 5030)
      aggregator.clear()

      remaining--
      if (remaining < 1) {
        // 6th harvest: no serialized trace, timings reset
        agent.traces.once('finished_data_send-transaction_sample_data', function () {
          assert.ok(!aggregator.requestTimes['WebTransaction/Uri/test'])

          end()
        })
        agent.traces.send()
      } else {
        agent.traces.once('finished_data_send-transaction_sample_data', looper)
        agent.traces.send()
      }
    }

    aggregator.add(tx)

    agent.traces.once('finished_data_send-transaction_sample_data', function () {
      assert.equal(aggregator.requestTimes['WebTransaction/Uri/test'], 5030)
      aggregator.clear()

      agent.traces.once('finished_data_send-transaction_sample_data', looper)
      agent.traces.send()
    })
    agent.traces.send()
  })

  await t.test('should reset the syntheticsTraces when resetting trace', function (t) {
    const { agent } = t.nr
    agent.config.transaction_tracer.enabled = true

    const aggregator = agent.traces
    createTransaction(agent, '/testOne', 503)
    assert.ok(aggregator.trace)
    aggregator.clear()

    createTransaction(agent, '/testTwo', 406, true)
    assert.ok(!aggregator.trace)
    assert.equal(aggregator.syntheticsTraces.length, 1)

    aggregator.clear()
    assert.equal(aggregator.syntheticsTraces.length, 0)
  })
})

test('TraceAggregator with top n support', async function (t) {
  t.beforeEach(function (ctx) {
    beforeEach(ctx)
    ctx.nr.config = configurator.initialize({
      transaction_tracer: {
        enabled: true
      }
    })
  })

  t.afterEach(afterEach)

  await t.test('should set n from its configuration', function (t) {
    const { config, agent } = t.nr
    const TOP_N = 21
    config.transaction_tracer.top_n = TOP_N
    const aggregator = new TraceAggregator({ config }, agent.collector, agent.harvester)

    assert.equal(aggregator.capacity, TOP_N)
  })

  await t.test('should track the top 20 slowest transactions if top_n is unconfigured', (t) => {
    const { config, agent } = t.nr
    const aggregator = new TraceAggregator({ config }, agent.collector, agent.harvester)

    assert.equal(aggregator.capacity, 20)
  })

  await t.test('should track the slowest transaction in a harvest period if top_n is 0', (t) => {
    const { config, agent } = t.nr
    config.transaction_tracer.top_n = 0
    const aggregator = new TraceAggregator({ config }, agent.collector, agent.harvester)

    assert.equal(aggregator.capacity, 1)
  })

  await t.test('should only save a trace for an existing name if new one is slower', (t) => {
    const { config, agent } = t.nr
    const URI = '/simple'
    const aggregator = new TraceAggregator({ config }, agent.collector, agent.harvester)
    aggregator.reported = 10 // needed to override "first 5"

    aggregator.add(createTransaction(agent, URI, 3000))
    aggregator.add(createTransaction(agent, URI, 2100))
    assert.equal(aggregator.requestTimes['WebTransaction/Uri/simple'], 3000)
    aggregator.add(createTransaction(agent, URI, 4000))
    assert.equal(aggregator.requestTimes['WebTransaction/Uri/simple'], 4000)
  })

  await t.test('should only track transactions for the top N names', function (t, end) {
    const { agent } = t.nr
    agent.config.transaction_tracer.top_n = 5
    agent.traces.capacity = 5
    agent.traces.reported = 10 // needed to override "first 5"
    const maxTraces = 6

    const txnCreator = (n, max, cb) => {
      assert.ok(!agent.traces.trace, 'trace before creation')
      createTransaction(agent, `/test-${n}`, 8000)
      if (n !== 5) {
        assert.ok(agent.traces.trace, `trace ${n} to be collected`)
      } else {
        assert.ok(!agent.traces.trace, 'trace 5 collected')
      }
      agent.traces.once('finished_data_send-transaction_sample_data', (err) => cb(err, { idx: n, max }))
      agent.traces.send()
      assert.ok(!agent.traces.trace, 'trace after harvest')
      if (n === 5) {
        end()
      }
    }
    const finalCallback = (err) => {
      assert.ok(!err)

      const times = agent.traces.requestTimes
      assert.equal(times['WebTransaction/Uri/test-0'], 8000)
      assert.equal(times['WebTransaction/Uri/test-1'], 8000)
      assert.equal(times['WebTransaction/Uri/test-2'], 8000)
      assert.equal(times['WebTransaction/Uri/test-3'], 8000)
      assert.equal(times['WebTransaction/Uri/test-4'], 8000)
      assert.ok(!times['WebTransaction/Uri/test-5'])
    }

    const testCallback = (err, props) => {
      assert.ok(!err)
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
