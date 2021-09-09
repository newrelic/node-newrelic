/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const nock = require('nock')
const helper = require('../../lib/agent_helper')
const sampler = require('../../../lib/sampler')
const configurator = require('../../../lib/config')
const Agent = require('../../../lib/agent')
const Transaction = require('../../../lib/transaction')
const CollectorResponse = require('../../../lib/collector/response')

const RUN_ID = 1337
const URL = 'https://collector.newrelic.com'

tap.test('should require configuration passed to constructor', (t) => {
  t.throws(() => new Agent())
  t.end()
})

tap.test('should not throw with valid config', (t) => {
  const config = configurator.initialize({ agent_enabled: false })
  const agent = new Agent(config)

  t.notOk(agent.config.agent_enabled)
  t.end()
})

tap.test('when loaded with defaults', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    // Load agent with default 'stopped' state
    agent = helper.loadMockedAgent(null, false)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('bootstraps its configuration', (t) => {
    t.ok(agent.config)
    t.end()
  })

  t.test('has an error tracer', (t) => {
    t.ok(agent.errors)
    t.end()
  })

  t.test('has query tracer', (t) => {
    t.ok(agent.queries)
    t.end()
  })

  t.test('uses an aggregator to apply top N slow trace logic', (t) => {
    t.ok(agent.traces)
    t.end()
  })

  t.test('has a URL normalizer', (t) => {
    t.ok(agent.urlNormalizer)
    t.end()
  })

  t.test('has a metric name normalizer', (t) => {
    t.ok(agent.metricNameNormalizer)
    t.end()
  })

  t.test('has a transaction name normalizer', (t) => {
    t.ok(agent.transactionNameNormalizer)
    t.end()
  })

  t.test('has a consolidated metrics collection that transactions feed into', (t) => {
    t.ok(agent.metrics)
    t.end()
  })

  t.test('has a function to look up the active transaction', (t) => {
    t.ok(agent.getTransaction)
    // should not throw
    agent.getTransaction()

    t.end()
  })

  t.test('requires new configuration to reconfigure the agent', (t) => {
    t.throws(() => agent.reconfigure())
    t.end()
  })

  t.test('defaults to a state of `stopped`', (t) => {
    t.equal(agent._state, 'stopped')
    t.end()
  })

  t.test('requires a valid value when changing state', (t) => {
    t.throws(() => agent.setState('bogus'), new Error('Invalid state bogus'))
    t.end()
  })

  t.test('has some debugging configuration by default', (t) => {
    t.ok(agent.config.debug)
    t.end()
  })
})

tap.test('should load naming rules when configured', (t) => {
  const config = configurator.initialize({
    rules: {
      name: [
        { pattern: '^/t', name: 'u' },
        { pattern: /^\/u/, name: 't' }
      ]
    }
  })

  const configured = new Agent(config)

  const rules = configured.userNormalizer.rules
  tap.equal(rules.length, 2 + 1) // +1 default ignore rule

  // Rules are reversed by default
  t.equal(rules[2].pattern.source, '^\\/u')

  t.equal(rules[1].pattern.source, '^\\/t')

  t.end()
})

tap.test('should load ignoring rules when configured', (t) => {
  const config = configurator.initialize({
    rules: { ignore: [/^\/ham_snadwich\/ignore/] }
  })

  const configured = new Agent(config)

  const rules = configured.userNormalizer.rules
  t.equal(rules.length, 1)
  t.equal(rules[0].pattern.source, '^\\/ham_snadwich\\/ignore')
  t.equal(rules[0].ignore, true)

  t.end()
})

tap.test('when forcing transaction ignore status', (t) => {
  t.autoend()

  let agentInstance = null

  t.beforeEach(() => {
    const config = configurator.initialize({
      rules: { ignore: [/^\/ham_snadwich\/ignore/] }
    })
    agentInstance = new Agent(config)
  })

  t.afterEach(() => {
    agentInstance = null
  })

  t.test('should not error when forcing an ignore', (t) => {
    const transaction = new Transaction(agentInstance)
    transaction.forceIgnore = true
    transaction.finalizeNameFromUri('/ham_snadwich/attend', 200)
    t.equal(transaction.ignore, true)

    // should not throw
    transaction.end()

    t.end()
  })

  t.test('should not error when forcing a non-ignore', (t) => {
    const transaction = new Transaction(agentInstance)
    transaction.forceIgnore = false
    transaction.finalizeNameFromUri('/ham_snadwich/ignore', 200)
    t.equal(transaction.ignore, false)

    // should not throw
    transaction.end()

    t.end()
  })

  t.test('should ignore when finalizeNameFromUri is not called', (t) => {
    const transaction = new Transaction(agentInstance)
    transaction.forceIgnore = true
    agentInstance._transactionFinished(transaction)
    t.equal(transaction.ignore, true)

    t.end()
  })
})

tap.test('#startAggregators should start all aggregators', (t) => {
  // Load agent with default 'stopped' state
  const agent = helper.loadMockedAgent(null, false)
  agent.config.distributed_tracing.enabled = true // for span events

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  agent.startAggregators()

  t.ok(agent.traces.sendTimer)
  t.ok(agent.errors.traceAggregator.sendTimer)
  t.ok(agent.errors.eventAggregator.sendTimer)
  t.ok(agent.spanEventAggregator.sendTimer)
  t.ok(agent.transactionEventAggregator.sendTimer)
  t.ok(agent.customEventAggregator.sendTimer)

  t.end()
})

tap.test('#startAggregators should start all aggregators', (t) => {
  // Load agent with default 'stopped' state
  const agent = helper.loadMockedAgent(null, false)
  agent.config.distributed_tracing.enabled = true // for span events

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  agent.startAggregators()

  t.ok(agent.traces.sendTimer)
  t.ok(agent.errors.traceAggregator.sendTimer)
  t.ok(agent.errors.eventAggregator.sendTimer)
  t.ok(agent.spanEventAggregator.sendTimer)
  t.ok(agent.transactionEventAggregator.sendTimer)
  t.ok(agent.customEventAggregator.sendTimer)

  t.end()
})

tap.test('#stopAggregators should stop all aggregators', (t) => {
  // Load agent with default 'stopped' state
  const agent = helper.loadMockedAgent(null, false)
  agent.config.distributed_tracing.enabled = true // for span events

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  agent.startAggregators()
  agent.stopAggregators()

  t.notOk(agent.traces.sendTimer)
  t.notOk(agent.errors.traceAggregator.sendTimer)
  t.notOk(agent.errors.eventAggregator.sendTimer)
  t.notOk(agent.spanEventAggregator.sendTimer)
  t.notOk(agent.transactionEventAggregator.sendTimer)
  t.notOk(agent.customEventAggregator.sendTimer)

  t.end()
})

tap.test('#onConnect should reconfigure all the aggregators', (t) => {
  const EXPECTED_AGG_COUNT = 8

  // Load agent with default 'stopped' state
  const agent = helper.loadMockedAgent(null, false)
  agent.config.distributed_tracing.enabled = true // for span events

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  // mock out the base reconfigure method
  const proto = agent.traces.__proto__.__proto__.__proto__
  const mock = sinon.mock(proto)

  agent.config.event_harvest_config = {
    report_period_ms: 5000,
    harvest_limits: {
      span_event_data: 1
    }
  }
  mock.expects('reconfigure').exactly(EXPECTED_AGG_COUNT)
  agent.onConnect(false, () => {
    mock.verify()

    t.end()
  })
})

tap.test('when starting', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    nock.disableNetConnect()

    // Load agent with default 'stopped' state
    agent = helper.loadMockedAgent(null, false)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null

    if (!nock.isDone()) {
      /* eslint-disable-next-line no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      nock.cleanAll()
    }

    nock.enableNetConnect()
  })

  t.test('should require a callback', (t) => {
    t.throws(() => agent.start(), new Error('callback required!'))

    t.end()
  })

  t.test('should change state to `starting`', (t) => {
    agent.collector.connect = function () {
      t.equal(agent._state, 'starting')
      t.end()
    }

    agent.start(function cbStart() {})
  })

  t.test('should not error when disabled via configuration', (t) => {
    agent.config.agent_enabled = false
    agent.collector.connect = function () {
      t.error(new Error('should not be called'))
      t.end()
    }
    agent.start(() => {
      t.end()
    })
  })

  t.test('should emit `stopped` when disabled via configuration', (t) => {
    agent.config.agent_enabled = false
    agent.collector.connect = function () {
      t.error(new Error('should not be called'))
      t.end()
    }

    agent.start(function cbStart() {
      t.equal(agent._state, 'stopped')
      t.end()
    })
  })

  t.test('should error when no license key is included', (t) => {
    agent.config.license_key = undefined
    agent.collector.connect = function () {
      t.error(new Error('should not be called'))
      t.end()
    }

    agent.start(function cbStart(error) {
      t.ok(error)

      t.end()
    })
  })

  t.test('should say why startup failed without license key', (t) => {
    agent.config.license_key = undefined

    agent.collector.connect = function () {
      t.error(new Error('should not be called'))
      t.end()
    }

    agent.start(function cbStart(error) {
      t.equal(error.message, 'Not starting without license key!')

      t.end()
    })
  })

  t.test('should call connect when using proxy', (t) => {
    agent.config.proxy = 'fake://url'

    agent.collector.connect = function (callback) {
      t.ok(callback)

      t.end()
    }

    agent.start(() => {})
  })

  t.test('should call connect when config is correct', (t) => {
    agent.collector.connect = function (callback) {
      t.ok(callback)
      t.end()
    }

    agent.start(() => {})
  })

  t.test('should error when connection fails', (t) => {
    const passed = new Error('passin on through')

    agent.collector.connect = function (callback) {
      callback(passed)
    }

    agent.start(function cbStart(error) {
      t.equal(error, passed)

      t.end()
    })
  })

  t.test('should harvest at connect when metrics are already there', (t) => {
    const metrics = nock(URL)
      .post(helper.generateCollectorPath('metric_data', RUN_ID))
      .reply(200, { return_value: [] })

    agent.collector.connect = function (callback) {
      agent.collector.isConnected = () => true
      callback(null, CollectorResponse.success(null, { agent_run_id: RUN_ID }))
    }

    agent.config.run_id = RUN_ID

    agent.metrics.measureMilliseconds('Test/Bogus', null, 1)

    agent.start(function cbStart(error) {
      t.error(error)
      t.ok(metrics.isDone())

      t.end()
    })
  })
})

tap.test('initial harvest', (t) => {
  t.autoend()

  const origInterval = global.setInterval

  let agent = null
  let redirect = null
  let connect = null
  let settings = null

  t.beforeEach(() => {
    nock.disableNetConnect()

    global.setInterval = (callback) => {
      return Object.assign({ unref: () => {} }, setImmediate(callback))
    }

    // Load agent with default 'stopped' state
    agent = helper.loadMockedAgent(null, false)

    // Avoid detection work / network call attempts
    agent.config.utilization = {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    }

    agent.config.no_immediate_harvest = true

    redirect = nock(URL)
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, {
        return_value: {
          redirect_host: 'collector.newrelic.com',
          security_policies: {}
        }
      })

    connect = nock(URL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, { return_value: { agent_run_id: RUN_ID } })

    settings = nock(URL)
      .post(helper.generateCollectorPath('agent_settings', RUN_ID))
      .reply(200, { return_value: [] })
  })

  t.afterEach(() => {
    global.setInterval = origInterval

    helper.unloadAgent(agent)
    agent = null

    if (!nock.isDone()) {
      /* eslint-disable-next-line no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      nock.cleanAll()
    }

    nock.enableNetConnect()
  })

  t.test('should not blow up when harvest cycle runs', (t) => {
    agent.start(() => {
      setTimeout(() => {
        t.ok(redirect.isDone())
        t.ok(connect.isDone())
        t.ok(settings.isDone())

        t.end()
      }, 15)
    })
  })

  t.test('should start aggregators after initial harvest', (t) => {
    let aggregatorsStarted = false

    agent.startAggregators = () => {
      aggregatorsStarted = true
    }

    agent.start(() => {
      setTimeout(() => {
        t.ok(aggregatorsStarted)

        t.ok(redirect.isDone())
        t.ok(connect.isDone())
        t.ok(settings.isDone())

        t.end()
      }, 15)
    })
  })

  t.test('should not blow up when harvest cycle errors', (t) => {
    const metrics = nock(URL).post(helper.generateCollectorPath('metric_data', RUN_ID)).reply(503)

    agent.start(function cbStart() {
      setTimeout(function () {
        global.setInterval = origInterval

        redirect.done()
        connect.done()
        settings.done()
        metrics.done()

        t.end()
      }, 15)
    })
  })
})

tap.test('when stopping', (t) => {
  t.autoend()

  function nop() {}

  let agent = null

  t.beforeEach(() => {
    // Load agent with default 'stopped' state
    agent = helper.loadMockedAgent(null, false)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('should require a callback', (t) => {
    t.throws(() => agent.stop(), new Error('callback required!'))
    t.end()
  })

  t.test('should stop sampler', (t) => {
    sampler.start(agent)
    agent.collector.shutdown = nop
    agent.stop(nop)

    t.equal(sampler.state, 'stopped')
    t.end()
  })

  t.test('should change state to `stopping`', (t) => {
    sampler.start(agent)
    agent.collector.shutdown = nop
    agent.stop(nop)

    t.equal(agent._state, 'stopping')
    t.end()
  })

  t.test('should not shut down connection if not connected', (t) => {
    agent.stop(function cbStop(error) {
      t.error(error)
      t.end()
    })
  })
})

tap.test('when stopping after connected', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    nock.disableNetConnect()

    // Load agent with default 'stopped' state
    agent = helper.loadMockedAgent(null, false)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null

    if (!nock.isDone()) {
      /* eslint-disable-next-line no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      nock.cleanAll()
    }

    nock.enableNetConnect()
  })

  t.test('should call shutdown', (t) => {
    agent.config.run_id = RUN_ID
    const shutdown = nock(URL)
      .post(helper.generateCollectorPath('shutdown', RUN_ID))
      .reply(200, { return_value: null })

    agent.stop(function cbStop(error) {
      t.error(error)
      t.notOk(agent.config.run_id)

      t.ok(shutdown.isDone())
      t.end()
    })
  })

  t.test('should pass through error if shutdown fails', (t) => {
    agent.config.run_id = RUN_ID
    const shutdown = nock(URL)
      .post(helper.generateCollectorPath('shutdown', RUN_ID))
      .replyWithError('whoops!')

    agent.stop((error) => {
      t.ok(error)
      t.equal(error.message, 'whoops!')

      t.ok(shutdown.isDone())
      t.end()
    })
  })
})

tap.test('when connected', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    nock.disableNetConnect()

    // Load agent with default 'stopped' state
    agent = helper.loadMockedAgent(null, false)

    // Avoid detection work / network call attempts
    agent.config.utilization = {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    }
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null

    if (!nock.isDone()) {
      /* eslint-disable-next-line no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      nock.cleanAll()
    }

    nock.enableNetConnect()
  })

  t.test('should update the metric apdexT value after connect', (t) => {
    t.equal(agent.metrics._apdexT, 0.1)

    agent.config.apdex_t = 0.666
    agent.onConnect(false, () => {
      t.ok(agent.metrics._apdexT)

      t.equal(agent.metrics._apdexT, 0.666)
      t.equal(agent.metrics._metrics.apdexT, 0.666)

      t.end()
    })
  })

  t.test('should reset the config and metrics normalizer on connection', (t) => {
    const config = {
      agent_run_id: 404,
      apdex_t: 0.742,
      url_rules: []
    }

    const redirect = nock(URL)
      .post(helper.generateCollectorPath('preconnect'))
      .reply(200, {
        return_value: {
          redirect_host: 'collector.newrelic.com',
          security_policies: {}
        }
      })

    const handshake = nock(URL)
      .post(helper.generateCollectorPath('connect'))
      .reply(200, { return_value: config })

    const settings = nock(URL)
      .post(helper.generateCollectorPath('agent_settings', 404))
      .reply(200, { return_value: config })

    const metrics = nock(URL)
      .post(helper.generateCollectorPath('metric_data', 404))
      .reply(200, { return_value: [] })

    const shutdown = nock(URL)
      .post(helper.generateCollectorPath('shutdown', 404))
      .reply(200, { return_value: null })

    agent.start(function cbStart(error) {
      t.error(error)
      t.ok(redirect.isDone())
      t.ok(handshake.isDone())

      t.equal(agent._state, 'started')
      t.equal(agent.config.run_id, 404)
      t.equal(agent.metrics._apdexT, 0.742)
      t.same(agent.urlNormalizer.rules, [])

      agent.stop(function cbStop() {
        t.ok(settings.isDone())
        t.ok(metrics.isDone())
        t.ok(shutdown.isDone())

        t.end()
      })
    })
  })
})

tap.test('when handling finished transactions', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    // Load agent with default 'stopped' state
    agent = helper.loadMockedAgent(null, false)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('should capture the trace off a finished transaction', (t) => {
    const transaction = new Transaction(agent)
    // need to initialize the trace
    transaction.trace.setDurationInMillis(2100)

    agent.once('transactionFinished', function () {
      const trace = agent.traces.trace
      t.ok(trace)
      t.equal(trace.getDurationInMillis(), 2100)

      t.end()
    })

    transaction.end()
  })

  t.test('should capture the synthetic trace off a finished transaction', (t) => {
    const transaction = new Transaction(agent)
    // need to initialize the trace
    transaction.trace.setDurationInMillis(2100)
    transaction.syntheticsData = {
      version: 1,
      accountId: 357,
      resourceId: 'resId',
      jobId: 'jobId',
      monitorId: 'monId'
    }

    agent.once('transactionFinished', function () {
      t.notOk(agent.traces.trace)
      t.equal(agent.traces.syntheticsTraces.length, 1)

      const trace = agent.traces.syntheticsTraces[0]
      t.equal(trace.getDurationInMillis(), 2100)

      t.end()
    })

    transaction.end()
  })

  t.test('should not merge metrics when transaction is ignored', (t) => {
    const transaction = new Transaction(agent)
    transaction.ignore = true

    /* Top-level method is bound into EE, so mock the metrics collection
     * instead.
     */
    const mock = sinon.mock(agent.metrics)
    mock.expects('merge').never()

    transaction.end()

    t.end()
  })

  t.test('should not merge errors when transaction is ignored', (t) => {
    const transaction = new Transaction(agent)
    transaction.ignore = true

    /* Top-level method is bound into EE, so mock the error tracer instead.
     */
    const mock = sinon.mock(agent.errors)
    mock.expects('onTransactionFinished').never()

    transaction.end()
    t.end()
  })

  t.test('should not aggregate trace when transaction is ignored', (t) => {
    const transaction = new Transaction(agent)
    transaction.ignore = true

    /* Top-level *and* second-level methods are bound into EEs, so mock the
     * transaction trace record method instead.
     */
    const mock = sinon.mock(transaction)
    mock.expects('record').never()

    transaction.end()
    t.end()
  })
})

tap.test('when sampling_target changes', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    // Load agent with default 'stopped' state
    agent = helper.loadMockedAgent(null, false)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('should adjust the current sampling target', (t) => {
    t.not(agent.transactionSampler.samplingTarget, 5)
    agent.config.onConnect({ sampling_target: 5 })
    t.equal(agent.transactionSampler.samplingTarget, 5)

    t.end()
  })

  t.test('should adjust the sampling period', (t) => {
    t.not(agent.transactionSampler.samplingPeriod, 100)
    agent.config.onConnect({ sampling_target_period_in_seconds: 0.1 })
    t.equal(agent.transactionSampler.samplingPeriod, 100)

    t.end()
  })
})

tap.test('when event_harvest_config updated on connect with a valid config', (t) => {
  t.autoend()

  const validHarvestConfig = {
    report_period_ms: 5000,
    harvest_limits: {
      analytic_event_data: 833,
      custom_event_data: 833,
      error_event_data: 8
    }
  }

  let agent = null

  t.beforeEach(() => {
    // Load agent with default 'stopped' state
    agent = helper.loadMockedAgent(null, false)

    agent.config.onConnect({ event_harvest_config: validHarvestConfig })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('should generate ReportPeriod supportability', (t) => {
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/ReportPeriod'

      const metric = agent.metrics.getMetric(expectedMetricName)

      t.ok(metric)
      t.equal(metric.total, validHarvestConfig.report_period_ms)

      t.end()
    })
  })

  t.test('should generate AnalyticEventData/HarvestLimit supportability', (t) => {
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/AnalyticEventData/HarvestLimit'

      const metric = agent.metrics.getMetric(expectedMetricName)

      t.ok(metric)
      t.equal(metric.total, validHarvestConfig.harvest_limits.analytic_event_data)

      t.end()
    })
  })

  t.test('should generate CustomEventData/HarvestLimit supportability', (t) => {
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/CustomEventData/HarvestLimit'

      const metric = agent.metrics.getMetric(expectedMetricName)

      t.ok(metric)
      t.equal(metric.total, validHarvestConfig.harvest_limits.custom_event_data)

      t.end()
    })
  })

  t.test('should generate ErrorEventData/HarvestLimit supportability', (t) => {
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/ErrorEventData/HarvestLimit'

      const metric = agent.metrics.getMetric(expectedMetricName)

      t.ok(metric)
      t.equal(metric.total, validHarvestConfig.harvest_limits.error_event_data)
      t.end()
    })
  })
})
