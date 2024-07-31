/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const promiseResolvers = require('../../lib/promise-resolvers')
const Collector = require('../../lib/test-collector')

const sinon = require('sinon')
const helper = require('../../lib/agent_helper')
const sampler = require('../../../lib/sampler')
const configurator = require('../../../lib/config')
const Agent = require('../../../lib/agent')
const Transaction = require('../../../lib/transaction')
const CollectorResponse = require('../../../lib/collector/response')

const RUN_ID = 1337

test('should require configuration passed to constructor', () => {
  assert.throws(() => new Agent())
})

test('should not throw with valid config', () => {
  const config = configurator.initialize({ agent_enabled: false })
  const agent = new Agent(config)
  assert.equal(agent.config.agent_enabled, false)
})

test('when loaded with defaults', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    // Load agent with default 'stopped' state.
    ctx.nr.agent = helper.loadMockedAgent(null, false)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('bootstraps its configuration', (t) => {
    const { agent } = t.nr
    assert.equal(Object.hasOwn(agent, 'config'), true)
  })

  await t.test('has error tracer', (t) => {
    const { agent } = t.nr
    assert.equal(Object.hasOwn(agent, 'errors'), true)
  })

  await t.test('has query tracer', (t) => {
    const { agent } = t.nr
    assert.equal(Object.hasOwn(agent, 'queries'), true)
  })

  await t.test('uses an aggregator to apply top N slow trace logic', (t) => {
    const { agent } = t.nr
    assert.equal(Object.hasOwn(agent, 'traces'), true)
  })

  await t.test('has URL normalizer', (t) => {
    const { agent } = t.nr
    assert.equal(Object.hasOwn(agent, 'urlNormalizer'), true)
  })

  await t.test('has a metric name normalizer', (t) => {
    const { agent } = t.nr
    assert.equal(Object.hasOwn(agent, 'metricNameNormalizer'), true)
  })

  await t.test('has a transaction name normalizer', (t) => {
    const { agent } = t.nr
    assert.equal(Object.hasOwn(agent, 'transactionNameNormalizer'), true)
  })

  await t.test('has a consolidated metrics collection that transactions feed into', (t) => {
    const { agent } = t.nr
    assert.equal(Object.hasOwn(agent, 'metrics'), true)
  })

  await t.test('has a function to look up the active transaction', (t) => {
    const { agent } = t.nr
    assert.equal(typeof agent.getTransaction === 'function', true)
    // Should not throw:
    agent.getTransaction()
  })

  await t.test('requires new configuration to reconfigure the agent', (t) => {
    const { agent } = t.nr
    assert.throws(() => agent.reconfigure())
  })

  await t.test('defaults to a state of "stopped"', (t) => {
    const { agent } = t.nr
    assert.equal(agent._state, 'stopped')
  })

  await t.test('requires a valid value when changing state', (t) => {
    const { agent } = t.nr
    assert.throws(() => agent.setState('bogus'), /Invalid state bogus/)
  })

  await t.test('has some debugging configuration by default', (t) => {
    const { agent } = t.nr
    assert.equal(Object.hasOwn(agent.config, 'debug'), true)
  })
})

test('should load naming rules when configured', () => {
  const config = configurator.initialize({
    rules: {
      name: [
        { pattern: '^/t', name: 'u' },
        { pattern: '/^/u/', name: 't' }
      ]
    }
  })
  const configured = new Agent(config)
  const rules = configured.userNormalizer.rules

  assert.equal(rules.length, 2 + 1) // +1 default ignore rule
  // Rules are reversed by default:
  assert.equal(rules[2].pattern.source, '\\/^\\/u\\/')
  assert.equal(rules[1].pattern.source, '^\\/t')
})

test('should load ignoring rules when configured', () => {
  const config = configurator.initialize({
    rules: { ignore: [/^\/ham_snadwich\/ignore/] }
  })
  const configured = new Agent(config)
  const rules = configured.userNormalizer.rules

  assert.equal(rules.length, 1)
  assert.equal(rules[0].pattern.source, '^\\/ham_snadwich\\/ignore')
  assert.equal(rules[0].ignore, true)
})

test('when forcing transaction ignore status', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const config = configurator.initialize({
      rules: { ignore: [/^\/ham_snadwich\/ignore/] }
    })
    ctx.nr.agent = new Agent(config)
  })

  await t.test('should not error when forcing an ignore', (t) => {
    const { agent } = t.nr
    const tx = new Transaction(agent)
    tx.forceIgnore = true
    tx.finalizeNameFromUri('/ham_snadwich/attend', 200)

    assert.equal(tx.ignore, true)
    // Should not throw:
    tx.end()
  })

  await t.test('should not error when forcing a non-ignore', (t) => {
    const { agent } = t.nr
    const tx = new Transaction(agent)
    tx.forceIgnore = false
    tx.finalizeNameFromUri('/ham_snadwich/ignore', 200)

    assert.equal(tx.ignore, false)
    // Should not throw:
    tx.end()
  })

  await t.test('should ignore when finalizeNameFromUri is not called', (t) => {
    const { agent } = t.nr
    const tx = new Transaction(agent)
    tx.forceIgnore = true
    agent._transactionFinished(tx)
    assert.equal(tx.ignore, true)
  })
})

test('#harvesters.start should start all aggregators', (t) => {
  const agent = helper.loadMockedAgent(null, false)
  t.after(() => {
    helper.unloadAgent(agent)
  })

  agent.harvester.start()
  const aggregators = [
    agent.traces,
    agent.errors.traceAggregator,
    agent.errors.eventAggregator,
    agent.spanEventAggregator,
    agent.transactionEventAggregator,
    agent.customEventAggregator,
    agent.logs
  ]
  for (const agg of aggregators) {
    assert.equal(Object.prototype.toString.call(agg.sendTimer), '[object Object]')
  }
})

test('#harvesters.stop should stop all aggregators', (t) => {
  // Load agent with default 'stopped' state:
  const agent = helper.loadMockedAgent(null, false)
  t.after(() => {
    helper.unloadAgent(agent)
  })

  agent.harvester.start()
  agent.harvester.stop()

  const aggregators = [
    agent.traces,
    agent.errors.traceAggregator,
    agent.errors.eventAggregator,
    agent.spanEventAggregator,
    agent.transactionEventAggregator,
    agent.customEventAggregator,
    agent.logs
  ]
  for (const agg of aggregators) {
    assert.equal(agg.sendTimer, null)
  }
})

test('#onConnect should reconfigure all the aggregators', async (t) => {
  const { promise, resolve } = promiseResolvers()
  const EXPECTED_AGG_COUNT = 9
  const agent = helper.loadMockedAgent(null, false)
  agent.config.application_logging.forwarding.enabled = true
  // Mock out the base reconfigure method:
  const proto = Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(agent.traces)))
  sinon.stub(proto, 'reconfigure')

  t.after(() => {
    helper.unloadAgent(agent)
    proto.reconfigure.restore()
  })

  agent.config.event_harvest_config = {
    report_period_ms: 5_000,
    harvest_limits: {
      span_event_data: 1
    }
  }
  agent.onConnect(false, () => {
    assert.equal(proto.reconfigure.callCount, EXPECTED_AGG_COUNT)
    resolve()
  })

  await promise
})

test('when starting', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector()
    ctx.nr.collector = collector
    await collector.listen()

    ctx.nr.agent = helper.loadMockedAgent(collector.agentConfig, false)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should require a callback', (t) => {
    const { agent } = t.nr
    assert.throws(() => agent.start(), /callback required/)
  })

  await t.test('should change to "starting"', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent } = t.nr
    agent.collector.connect = function () {
      assert.equal(agent._state, 'starting')
      resolve()
    }
    agent.start(() => {})
    await promise
  })

  await t.test('should not error when disabled via configuration', async (t) => {
    const { promise, resolve, reject } = promiseResolvers()
    const { agent } = t.nr
    agent.config.agent_enabled = false
    agent.collector.connect = function () {
      reject(Error('should not be called'))
    }
    agent.start(() => resolve())
    await promise
  })

  await t.test('should emit "stopped" when disabled via configuration', async (t) => {
    const { promise, resolve, reject } = promiseResolvers()
    const { agent } = t.nr
    agent.config.agent_enabled = false
    agent.collector.connect = function () {
      reject(Error('should not be called'))
    }
    agent.start(() => {
      assert.equal(agent._state, 'stopped')
      resolve()
    })
    await promise
  })

  await t.test('should error when no license key is included', async (t) => {
    const { promise, resolve, reject } = promiseResolvers()
    const { agent } = t.nr
    agent.config.license_key = undefined
    agent.collector.connect = function () {
      reject(Error('should not be called'))
    }
    agent.start((error) => {
      assert.equal(error.message, 'Not starting without license key!')
      resolve()
    })
    await promise
  })

  await t.test('should call connect when using proxy', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent } = t.nr
    agent.config.proxy = 'fake://url'
    agent.collector.connect = function (callback) {
      assert.equal(typeof callback, 'function')
      resolve()
    }
    agent.start(() => {})
    await promise
  })

  await t.test('should call connect when config is correct', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent } = t.nr
    agent.collector.connect = function (callback) {
      assert.equal(typeof callback, 'function')
      resolve()
    }
    agent.start(() => {})
    await promise
  })

  await t.test('should error when connection fails', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent } = t.nr
    const expected = Error('boom')
    agent.collector.connect = function (callback) {
      callback(expected)
    }
    agent.start((error) => {
      assert.equal(error, expected)
      resolve()
    })
    await promise
  })

  await t.test('should harvest at connect when metrics are already there', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent, collector } = t.nr

    collector.addHandler(helper.generateCollectorPath('metric_data', RUN_ID), (req, res) => {
      res.json({ payload: { return_value: [] } })
    })

    agent.collector.connect = function (callback) {
      agent.collector.isConnected = () => true
      callback(null, CollectorResponse.success(null, { agent_run_id: RUN_ID }))
    }
    agent.config.run_id = RUN_ID
    agent.metrics.measureMilliseconds('Test/Bogus', null, 1)

    agent.start((error) => {
      agent.forceHarvestAll(() => {
        assert.equal(error, undefined)
        // assert.equal(metrics.isDone(), true)
        assert.equal(collector.isDone('metric_data'), true)
        resolve()
      })
    })

    await promise
  })
})

test('initial harvest', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector()
    ctx.nr.collector = collector
    await collector.listen()

    ctx.nr.agent = helper.loadMockedAgent(collector.agentConfig, false)
    ctx.nr.agent.config.utilization = {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    }
    ctx.nr.agent.config.no_immediate_harvest = true
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  })

  await t.test('should not blow up when harvest cycle runs', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent, collector } = t.nr
    agent.start(() => {
      setTimeout(() => {
        assert.equal(collector.isDone('preconnect'), true)
        assert.equal(collector.isDone('connect'), true)
        assert.equal(collector.isDone('agent_settings'), true)
        resolve()
      }, 15)
    })
    await promise
  })

  await t.test('should start aggregators after initial harvest', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent, collector } = t.nr

    sinon.stub(agent.harvester, 'start')
    t.after(() => sinon.restore())

    agent.start(() => {
      setTimeout(() => {
        assert.equal(agent.harvester.start.callCount, 1)
        assert.equal(collector.isDone('preconnect'), true)
        assert.equal(collector.isDone('connect'), true)
        assert.equal(collector.isDone('agent_settings'), true)
        resolve()
      }, 15)
    })

    await promise
  })

  await t.test('should not blow up when harvest cycle errors', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent, collector } = t.nr

    collector.addHandler(helper.generateCollectorPath('metric_data', RUN_ID), (req, res) => {
      res.writeHead(503)
      res.end()
    })

    agent.start(() => {
      agent.forceHarvestAll(() => {
        assert.equal(collector.isDone('preconnect'), true)
        assert.equal(collector.isDone('connect'), true)
        assert.equal(collector.isDone('agent_settings'), true)
        assert.equal(collector.isDone('metric_data'), true)
        resolve()
      })
    })
    await promise
  })
})

test('when stopping', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent(null, false)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should require a callback', (t) => {
    const { agent } = t.nr
    assert.throws(() => agent.stop(), /callback required!/)
  })

  await t.test('should stop sampler', (t) => {
    const { agent } = t.nr
    sampler.start(agent)
    agent.collector.shutdown = () => {}
    agent.stop(() => {})
    assert.equal(sampler.state, 'stopped')
  })

  await t.test('should change state to "stopping"', (t) => {
    const { agent } = t.nr
    sampler.start(agent)
    agent.collector.shutdown = () => {}
    agent.stop(() => {})
    assert.equal(agent._state, 'stopping')
  })

  await t.test('should not shut down connection if not connected', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent } = t.nr
    agent.stop((error) => {
      assert.equal(error, undefined)
      resolve()
    })
    await promise
  })
})

test('when stopping after connected', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector()
    ctx.nr.collector = collector
    await collector.listen()

    ctx.nr.agent = helper.loadMockedAgent(collector.agentConfig, false)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  })

  await t.test('should call shutdown', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent, collector } = t.nr

    agent.config.run_id = RUN_ID

    collector.addHandler(helper.generateCollectorPath('shutdown', RUN_ID), (req, res) => {
      res.json({ payload: { return_value: null } })
    })

    agent.stop((error) => {
      assert.equal(error, undefined)
      assert.equal(agent.config.run_id, null)
      assert.equal(collector.isDone('shutdown'), true)
      resolve()
    })
    await promise
  })

  await t.test('should pass through error if shutdown fails', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent, collector } = t.nr

    agent.config.run_id = RUN_ID

    let shutdownIsDone = false
    collector.addHandler(helper.generateCollectorPath('shutdown', RUN_ID), (req) => {
      shutdownIsDone = true
      req.destroy()
    })

    agent.stop((error) => {
      assert.equal(error.message, 'socket hang up')
      assert.equal(shutdownIsDone, true)
      resolve()
    })
    await promise
  })
})

test('when connected', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector()
    ctx.nr.collector = collector
    await collector.listen()

    ctx.nr.agent = helper.loadMockedAgent(collector.agentConfig, false)
    ctx.nr.agent.config.utilization = {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  })

  await t.test('should update the metric apdexT value after connect', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent } = t.nr

    assert.equal(agent.metrics._apdexT, 0.1)
    agent.config.apdex_t = 0.666
    agent.onConnect(false, () => {
      assert.equal(agent.metrics._apdexT, 0.666)
      assert.equal(agent.metrics._metrics.apdexT, 0.666)
      resolve()
    })
    await promise
  })

  await t.test('should reset the config and metrics normalizer on connection', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent, collector } = t.nr
    const config = {
      agent_run_id: 1122,
      apdex_t: 0.742,
      url_rules: []
    }

    collector.addHandler(helper.generateCollectorPath('connect'), (req, res) => {
      res.json({ payload: { return_value: config } })
    })

    assert.equal(agent.metrics._apdexT, 0.1)
    agent.start((error) => {
      assert.equal(error, undefined)
      assert.equal(collector.isDone('preconnect'), true)
      assert.equal(collector.isDone('connect'), true)
      assert.equal(agent._state, 'started')
      assert.equal(agent.config.run_id, 1122)
      assert.equal(agent.metrics._apdexT, 0.742)
      assert.deepStrictEqual(agent.urlNormalizer.rules, [])
      resolve()
    })
    await promise
  })

  function setupAggregators({ enableAggregator: enableAggregator = true, agent, collector }) {
    agent.config.application_logging.enabled = enableAggregator
    agent.config.application_logging.forwarding.enabled = enableAggregator
    agent.config.slow_sql.enabled = enableAggregator
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.distributed_tracing.enabled = enableAggregator
    agent.config.custom_insights_events.enabled = enableAggregator
    agent.config.transaction_events.enabled = enableAggregator
    agent.config.transaction_tracer.enabled = enableAggregator
    agent.config.collect_errors = enableAggregator
    agent.config.error_collector.capture_events = enableAggregator

    const runId = 1122
    const config = { agent_run_id: runId }
    const payload = { return_value: [] }

    collector.addHandler(helper.generateCollectorPath('connect'), (req, res) => {
      res.json({ payload: { return_value: config } })
    })
    // Note: we cannot re-use a single handler function because the `isDone`
    // indicator is attached to the handler. Therefore, if we reused the same
    // function for all events, all events would look like they are "done" if
    // any one of them gets invoked.
    collector.addHandler(helper.generateCollectorPath('metric_data', runId), (req, res) => {
      res.json({ payload })
    })
    collector.addHandler(helper.generateCollectorPath('log_event_data', runId), (req, res) => {
      res.json({ payload })
    })
    collector.addHandler(helper.generateCollectorPath('sql_trace_data', runId), (req, res) => {
      res.json({ payload })
    })
    collector.addHandler(helper.generateCollectorPath('span_event_data', runId), (req, res) => {
      res.json({ payload })
    })
    collector.addHandler(helper.generateCollectorPath('analytic_event_data', runId), (req, res) => {
      res.json({ payload })
    })
    collector.addHandler(
      helper.generateCollectorPath('transaction_sample_data', runId),
      (req, res) => {
        res.json({ payload })
      }
    )
    collector.addHandler(helper.generateCollectorPath('custom_event_data', runId), (req, res) => {
      res.json({ payload })
    })
    collector.addHandler(helper.generateCollectorPath('error_data', runId), (req, res) => {
      res.json({ payload })
    })
    collector.addHandler(helper.generateCollectorPath('error_event_data', runId), (req, res) => {
      res.json({ payload })
    })
  }

  await t.test('should force harvest of all aggregators 1 second after connect', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const { agent, collector } = t.nr

    setupAggregators({ agent, collector })

    agent.logs.add([{ key: 'bar' }])
    const tx = new helper.FakeTransaction(agent, '/path/to/fake')
    tx.metrics = { apdexT: 0 }
    const segment = new helper.FakeSegment(tx, 2_000)
    agent.queries.add(segment, 'mysql', 'select * from foo', 'Stack\nFrames')
    agent.spanEventAggregator.add(segment)
    agent.transactionEventAggregator.add(tx)
    agent.customEventAggregator.add({ key: 'value' })
    agent.traces.add(tx)
    const err = Error('test error')
    agent.errors.traceAggregator.add(err)
    agent.errors.eventAggregator.add(err)

    agent.start((error) => {
      agent.forceHarvestAll(() => {
        assert.equal(error, undefined)
        assert.equal(collector.isDone('preconnect'), true)
        assert.equal(collector.isDone('connect'), true)
        assert.equal(collector.isDone('metric_data'), true)
        assert.equal(collector.isDone('log_event_data'), true)
        assert.equal(collector.isDone('sql_trace_data'), true)
        assert.equal(collector.isDone('span_event_data'), true)
        assert.equal(collector.isDone('analytic_event_data'), true)
        assert.equal(collector.isDone('transaction_sample_data'), true)
        assert.equal(collector.isDone('custom_event_data'), true)
        assert.equal(collector.isDone('error_data'), true)
        assert.equal(collector.isDone('error_event_data'), true)
        resolve()
      })
    })
    await promise
  })

  await t.test(
    'should force harvest of only metric data 1 second after connect when all other aggregators are disabled',
    async (t) => {
      const { promise, resolve } = promiseResolvers()
      const { agent, collector } = t.nr

      setupAggregators({ enableAggregator: false, agent, collector })

      agent.logs.add([{ key: 'bar' }])
      const tx = new helper.FakeTransaction(agent, '/path/to/fake')
      tx.metrics = { apdexT: 0 }
      const segment = new helper.FakeSegment(tx, 2_000)
      agent.queries.add(segment, 'mysql', 'select * from foo', 'Stack\nFrames')
      agent.spanEventAggregator.add(segment)
      agent.transactionEventAggregator.add(tx)
      agent.customEventAggregator.add({ key: 'value' })
      agent.traces.add(tx)
      const err = Error('test error')
      agent.errors.traceAggregator.add(err)
      agent.errors.eventAggregator.add(err)

      agent.start((error) => {
        agent.forceHarvestAll(() => {
          assert.equal(error, undefined)
          assert.equal(collector.isDone('preconnect'), true)
          assert.equal(collector.isDone('connect'), true)
          assert.equal(collector.isDone('metric_data'), true)
          assert.equal(collector.isDone('log_event_data'), false)
          assert.equal(collector.isDone('sql_trace_data'), false)
          assert.equal(collector.isDone('span_event_data'), false)
          assert.equal(collector.isDone('analytic_event_data'), false)
          assert.equal(collector.isDone('transaction_sample_data'), false)
          assert.equal(collector.isDone('custom_event_data'), false)
          assert.equal(collector.isDone('error_data'), false)
          assert.equal(collector.isDone('error_event_data'), false)
          resolve()
        })
      })
      await promise
    }
  )

  await t.test(
    'should not post data when there is none in aggregators during a force harvest',
    async (t) => {
      const { promise, resolve } = promiseResolvers()
      const { agent, collector } = t.nr

      setupAggregators({ agent, collector })

      agent.start((error) => {
        assert.equal(error, undefined)
        assert.equal(collector.isDone('preconnect'), true)
        assert.equal(collector.isDone('connect'), true)
        assert.equal(collector.isDone('metric_data'), true)
        assert.equal(collector.isDone('log_event_data'), false)
        assert.equal(collector.isDone('sql_trace_data'), false)
        assert.equal(collector.isDone('span_event_data'), false)
        assert.equal(collector.isDone('analytic_event_data'), false)
        assert.equal(collector.isDone('transaction_sample_data'), false)
        assert.equal(collector.isDone('custom_event_data'), false)
        assert.equal(collector.isDone('error_data'), false)
        assert.equal(collector.isDone('error_event_data'), false)
        resolve()
      })
      await promise
    }
  )
})

test('when handling finished transactions', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent(null, false)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should capture the trace off a finished transaction', async (t) => {
    const { agent } = t.nr
    const { promise, resolve } = promiseResolvers()
    const tx = new Transaction(agent)

    // Initialize the trace:
    tx.trace.setDurationInMillis(2_100)

    agent.once('transactionFinished', () => {
      const trace = agent.traces.trace
      assert.equal(Object.prototype.toString.call(trace), '[object Object]')
      assert.equal(trace.getDurationInMillis(), 2_100)
      resolve()
    })
    tx.end()
    await promise
  })

  await t.test('should capture the synthetic trace off a finished transaction', async (t) => {
    const { agent } = t.nr
    const { promise, resolve } = promiseResolvers()
    const tx = new Transaction(agent)

    // Initialize trace:
    tx.trace.setDurationInMillis(2_100)
    tx.syntheticsData = {
      version: 1,
      accountId: 357,
      resourceId: 'resId',
      jobId: 'jobId',
      monitorId: 'monId'
    }

    agent.once('transactionFinished', () => {
      assert.equal(agent.traces.trace, null)
      assert.equal(agent.traces.syntheticsTraces.length, 1)

      const trace = agent.traces.syntheticsTraces[0]
      assert.equal(trace.getDurationInMillis(), 2_100)

      resolve()
    })
    tx.end()
    await promise
  })

  await t.test('should not merge metrics when transaction is ignored', (t) => {
    const { agent } = t.nr
    const tx = new Transaction(agent)
    tx.ignore = true

    // Top-level method is bound into EE, so mock the metrics collection instead.
    const mock = sinon.mock(agent.metrics)
    mock.expects('merge').never()

    tx.end()
  })

  await t.test('should not merge errors when transaction is ignored', (t) => {
    const { agent } = t.nr
    const tx = new Transaction(agent)
    tx.ignore = true

    // Top-level method is bound into EE, so mock the metrics collection instead.
    const mock = sinon.mock(agent.errors)
    mock.expects('onTransactionFinished').never()

    tx.end()
  })

  await t.test('should not aggregate trace when transaction is ignored', (t) => {
    const { agent } = t.nr
    const tx = new Transaction(agent)
    tx.ignore = true

    // Top-level method is bound into EE, so mock the metrics collection instead.
    const mock = sinon.mock(tx)
    mock.expects('record').never()

    tx.end()
  })
})

test('when sampling_target changes', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent(null, false)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should adjust the current sampling target', (t) => {
    const { agent } = t.nr
    assert.notEqual(agent.transactionSampler.samplingTarget, 5)
    agent.config.onConnect({ sampling_target: 5 })
    assert.equal(agent.transactionSampler.samplingTarget, 5)
  })

  await t.test('should adjust the sampling period', (t) => {
    const { agent } = t.nr
    assert.notEqual(agent.transactionSampler.samplingPeriod, 100)
    agent.config.onConnect({ sampling_target_period_in_seconds: 0.1 })
    assert.equal(agent.transactionSampler.samplingPeriod, 100)
  })
})

test('when event_harvest_config update on connect with a valid config', async (t) => {
  t.beforeEach((ctx) => {
    const validHarvestConfig = {
      report_period_ms: 5_000,
      harvest_limits: {
        analytic_event_data: 833,
        custom_event_data: 833,
        error_event_data: 8,
        span_event_data: 200,
        log_event_data: 833
      }
    }

    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent(null, false)
    ctx.nr.agent.config.onConnect({ event_harvest_config: validHarvestConfig })

    ctx.nr.validHarvestConfig = validHarvestConfig
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should generate ReportPeriod supportability', async (t) => {
    const { agent, validHarvestConfig } = t.nr
    const { promise, resolve } = promiseResolvers()
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/ReportPeriod'
      const metric = agent.metrics.getMetric(expectedMetricName)
      assert.equal(metric.total, validHarvestConfig.report_period_ms)
      resolve()
    })
    await promise
  })

  await t.test('should generate AnalyticEventData/HarvestLimit supportability', async (t) => {
    const { agent, validHarvestConfig } = t.nr
    const { promise, resolve } = promiseResolvers()
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/AnalyticEventData/HarvestLimit'
      const metric = agent.metrics.getMetric(expectedMetricName)
      assert.equal(metric.total, validHarvestConfig.harvest_limits.analytic_event_data)
      resolve()
    })
    await promise
  })

  await t.test('should generate CustomEventData/HarvestLimit supportability', async (t) => {
    const { agent, validHarvestConfig } = t.nr
    const { promise, resolve } = promiseResolvers()
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/CustomEventData/HarvestLimit'
      const metric = agent.metrics.getMetric(expectedMetricName)
      assert.equal(metric.total, validHarvestConfig.harvest_limits.custom_event_data)
      resolve()
    })
    await promise
  })

  await t.test('should generate ErrorEventData/HarvestLimit supportability', async (t) => {
    const { agent, validHarvestConfig } = t.nr
    const { promise, resolve } = promiseResolvers()
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/ErrorEventData/HarvestLimit'
      const metric = agent.metrics.getMetric(expectedMetricName)
      assert.equal(metric.total, validHarvestConfig.harvest_limits.error_event_data)
      resolve()
    })
    await promise
  })

  await t.test('should generate SpanEventData/HarvestLimit supportability', async (t) => {
    const { agent, validHarvestConfig } = t.nr
    const { promise, resolve } = promiseResolvers()
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/SpanEventData/HarvestLimit'
      const metric = agent.metrics.getMetric(expectedMetricName)
      assert.equal(metric.total, validHarvestConfig.harvest_limits.span_event_data)
      resolve()
    })
    await promise
  })

  await t.test('should generate LogEventData/HarvestLimit supportability', async (t) => {
    const { agent, validHarvestConfig } = t.nr
    const { promise, resolve } = promiseResolvers()
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/LogEventData/HarvestLimit'
      const metric = agent.metrics.getMetric(expectedMetricName)
      assert.equal(metric.total, validHarvestConfig.harvest_limits.log_event_data)
      resolve()
    })
    await promise
  })
})

test('logging supportability on connect', async (t) => {
  const keys = ['Forwarding', 'Metrics', 'LocalDecorating']

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent(null, false)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should increment disabled metrics when logging features are off', async (t) => {
    const { agent } = t.nr
    const { promise, resolve } = promiseResolvers()

    agent.config.application_logging.enabled = true
    agent.config.application_logging.metrics.enabled = false
    agent.config.application_logging.forwarding.enabled = false
    agent.config.application_logging.local_decorating.enabled = false
    agent.onConnect(false, () => {
      for (const key of keys) {
        const disabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/disabled`)
        const enabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/enabled`)
        assert.equal(disabled.callCount, 1)
        assert.equal(enabled, undefined)
      }
      resolve()
    })
    await promise
  })

  await t.test(
    'should increment disabled metrics when logging features are on but application_logging.enabled is false',
    async (t) => {
      const { agent } = t.nr
      const { promise, resolve } = promiseResolvers()

      agent.config.application_logging.enabled = false
      agent.config.application_logging.metrics.enabled = true
      agent.config.application_logging.forwarding.enabled = true
      agent.config.application_logging.local_decorating.enabled = true
      agent.onConnect(false, () => {
        for (const key of keys) {
          const disabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/disabled`)
          const enabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/enabled`)
          assert.equal(disabled.callCount, 1)
          assert.equal(enabled, undefined)
        }
        resolve()
      })
      await promise
    }
  )

  await t.test('should increment disabled metrics when logging features are on', async (t) => {
    const { agent } = t.nr
    const { promise, resolve } = promiseResolvers()

    agent.config.application_logging.enabled = true
    agent.config.application_logging.metrics.enabled = true
    agent.config.application_logging.forwarding.enabled = true
    agent.config.application_logging.local_decorating.enabled = true
    agent.onConnect(false, () => {
      for (const key of keys) {
        const disabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/disabled`)
        const enabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/enabled`)
        assert.equal(enabled.callCount, 1)
        assert.equal(disabled, undefined)
      }
      resolve()
    })
    await promise
  })

  await t.test('should default llm to an object', (t) => {
    const { agent } = t.nr
    assert.deepStrictEqual(agent.llm, {})
  })
})

test('getNRLinkingMetadata', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should properly format the NR-LINKING pipe string', async (t) => {
    const { agent } = t.nr
    const { promise, resolve } = promiseResolvers()
    agent.config.entity_guid = 'unit-test'
    helper.runInTransaction(agent, 'nr-linking-test', (tx) => {
      const nrLinkingMeta = agent.getNRLinkingMetadata()
      const expectedLinkingMeta = ` NR-LINKING|unit-test|${agent.config.getHostnameSafe()}|${
        tx.traceId
      }|${tx.trace.root.id}|New%20Relic%20for%20Node.js%20tests|`
      assert.equal(
        nrLinkingMeta,
        expectedLinkingMeta,
        'NR-LINKING metadata should be properly formatted'
      )
      resolve()
    })
    await promise
  })

  await t.test('should properly handle if parts of NR-LINKING are undefined', (t) => {
    const { agent } = t.nr
    const nrLinkingMeta = agent.getNRLinkingMetadata()
    const expectedLinkingMeta = ` NR-LINKING||${agent.config.getHostnameSafe()}|||New%20Relic%20for%20Node.js%20tests|`
    assert.equal(
      nrLinkingMeta,
      expectedLinkingMeta,
      'NR-LINKING metadata should be properly formatted'
    )
  })
})

test('_reset*', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.agent = agent

    const sandbox = sinon.createSandbox()
    sandbox.stub(agent.queries, 'clear')
    sandbox.stub(agent.errors, 'clearAll')
    sandbox.stub(agent.errors.traceAggregator, 'reconfigure')
    sandbox.stub(agent.errors.eventAggregator, 'reconfigure')
    sandbox.stub(agent.transactionEventAggregator, 'clear')
    sandbox.stub(agent.customEventAggregator, 'clear')
    ctx.nr.sandbox = sandbox
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.sandbox.restore()
  })

  await t.test('should clear queries on _resetQueries', (t) => {
    const { agent } = t.nr
    agent._resetQueries()
    assert.equal(agent.queries.clear.callCount, 1)
  })

  await t.test(
    'should clear errors and reconfigure error traces and events on _resetErrors',
    (t) => {
      const { agent } = t.nr
      agent._resetErrors()
      assert.equal(agent.errors.clearAll.callCount, 1)
      assert.equal(agent.errors.traceAggregator.reconfigure.callCount, 1)
      assert.equal(agent.errors.eventAggregator.reconfigure.callCount, 1)
    }
  )

  await t.test('should clear transaction events on _resetEvents', (t) => {
    const { agent } = t.nr
    agent._resetEvents()
    assert.equal(agent.transactionEventAggregator.clear.callCount, 1)
  })

  await t.test('should clear custom events on _resetCustomEvents', (t) => {
    const { agent } = t.nr
    agent._resetCustomEvents()
    assert.equal(agent.customEventAggregator.clear.callCount, 1)
  })
})
