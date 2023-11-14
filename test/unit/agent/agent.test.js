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
  agent.config.application_logging.forwarding.enabled = true

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
  t.ok(agent.logs.sendTimer)

  t.end()
})

tap.test('#stopAggregators should stop all aggregators', (t) => {
  // Load agent with default 'stopped' state
  const agent = helper.loadMockedAgent(null, false)
  agent.config.application_logging.forwarding.enabled = true

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
  t.notOk(agent.logs.sendTimer)

  t.end()
})

tap.test('#onConnect should reconfigure all the aggregators', (t) => {
  const EXPECTED_AGG_COUNT = 9

  // Load agent with default 'stopped' state
  const agent = helper.loadMockedAgent(null, false)
  agent.config.application_logging.forwarding.enabled = true

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

  function mockHandShake(config = {}) {
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
    return { redirect, handshake }
  }

  function setupAggregators(enableAggregator) {
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
    const config = {
      agent_run_id: runId
    }
    const { redirect, handshake } = mockHandShake(config)
    const metrics = nock(URL)
      .post(helper.generateCollectorPath('metric_data', runId))
      .reply(200, { return_value: [] })
    const logs = nock(URL)
      .post(helper.generateCollectorPath('log_event_data', runId))
      .reply(200, { return_value: [] })
    const sql = nock(URL)
      .post(helper.generateCollectorPath('sql_trace_data', runId))
      .reply(200, { return_value: [] })
    const spanEventAggregator = nock(URL)
      .post(helper.generateCollectorPath('span_event_data', runId))
      .reply(200, { return_value: [] })
    const transactionEvents = nock(URL)
      .post(helper.generateCollectorPath('analytic_event_data', runId))
      .reply(200, { return_value: [] })
    const transactionSamples = nock(URL)
      .post(helper.generateCollectorPath('transaction_sample_data', runId))
      .reply(200, { return_value: [] })
    const customEvents = nock(URL)
      .post(helper.generateCollectorPath('custom_event_data', runId))
      .reply(200, { return_value: [] })
    const errorTransactionEvents = nock(URL)
      .post(helper.generateCollectorPath('error_data', runId))
      .reply(200, { return_value: [] })
    const errorEvents = nock(URL)
      .post(helper.generateCollectorPath('error_event_data', runId))
      .reply(200, { return_value: [] })

    return {
      redirect,
      handshake,
      metrics,
      logs,
      sql,
      spanEventAggregator,
      transactionSamples,
      transactionEvents,
      customEvents,
      errorTransactionEvents,
      errorEvents
    }
  }

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
      agent_run_id: 1122,
      apdex_t: 0.742,
      url_rules: []
    }

    const { redirect, handshake } = mockHandShake(config)
    const shutdown = nock(URL)
      .post(helper.generateCollectorPath('shutdown', 1122))
      .reply(200, { return_value: null })

    t.equal(agent.metrics._apdexT, 0.1)
    agent.start(function cbStart(error) {
      t.error(error)
      t.ok(redirect.isDone())
      t.ok(handshake.isDone())

      t.equal(agent._state, 'started')
      t.equal(agent.config.run_id, 1122)
      t.equal(agent.metrics._apdexT, 0.742)
      t.same(agent.urlNormalizer.rules, [])

      agent.stop(function cbStop() {
        t.ok(shutdown.isDone())

        t.end()
      })
    })
  })

  t.test('should force harvest of all aggregators 1 second after connect', (t) => {
    const {
      redirect,
      handshake,
      metrics,
      logs,
      sql,
      spanEventAggregator,
      transactionEvents,
      transactionSamples,
      customEvents,
      errorTransactionEvents,
      errorEvents
    } = setupAggregators(true)

    agent.logs.add([{ key: 'bar' }])
    const tx = new helper.FakeTransaction(agent, '/path/to/fake')
    tx.metrics = { apdexT: 0 }
    const segment = new helper.FakeSegment(tx, 2000)
    agent.queries.add(segment, 'mysql', 'select * from foo', 'Stack\nFrames')
    agent.spanEventAggregator.add(segment)
    agent.transactionEventAggregator.add(tx)
    agent.customEventAggregator.add({ key: 'value' })
    agent.traces.add(tx)
    const err = new Error('test error')
    agent.errors.traceAggregator.add(err)
    agent.errors.eventAggregator.add(err)

    agent.start((err) => {
      t.error(err)
      t.ok(redirect.isDone())
      t.ok(handshake.isDone())
      t.ok(metrics.isDone())
      t.ok(logs.isDone())
      t.ok(sql.isDone())
      t.ok(spanEventAggregator.isDone())
      t.ok(transactionEvents.isDone())
      t.ok(transactionSamples.isDone())
      t.ok(customEvents.isDone())
      t.ok(errorTransactionEvents.isDone())
      t.ok(errorEvents.isDone())
      t.end()
    })
  })

  t.test(
    'should force harvest of only metric data 1 second after connect when all other aggregators are disabled',
    (t) => {
      const {
        redirect,
        handshake,
        metrics,
        logs,
        sql,
        spanEventAggregator,
        transactionEvents,
        transactionSamples,
        customEvents,
        errorTransactionEvents,
        errorEvents
      } = setupAggregators(false)

      agent.logs.add([{ key: 'bar' }])
      const tx = new helper.FakeTransaction(agent, '/path/to/fake')
      tx.metrics = { apdexT: 0 }
      const segment = new helper.FakeSegment(tx, 2000)
      agent.queries.add(segment, 'mysql', 'select * from foo', 'Stack\nFrames')
      agent.spanEventAggregator.add(segment)
      agent.transactionEventAggregator.add(tx)
      agent.customEventAggregator.add({ key: 'value' })
      agent.traces.add(tx)
      const err = new Error('test error')
      agent.errors.traceAggregator.add(err)
      agent.errors.eventAggregator.add(err)

      agent.start((err) => {
        t.error(err)
        t.ok(redirect.isDone())
        t.ok(handshake.isDone())
        t.ok(metrics.isDone())
        t.notOk(logs.isDone())
        t.notOk(sql.isDone())
        t.notOk(spanEventAggregator.isDone())
        t.notOk(transactionEvents.isDone())
        t.notOk(transactionSamples.isDone())
        t.notOk(customEvents.isDone())
        t.notOk(errorTransactionEvents.isDone())
        t.notOk(errorEvents.isDone())
        /**
         * cleaning pending calls to avoid the afterEach
         * saying it is clearing pending calls
         * we know these are pending so let's be explicit
         * vs the afterEach which helps us understanding things
         * that need cleaned up
         */
        nock.cleanAll()
        t.end()
      })
    }
  )

  t.test('should not post data when there is none in aggregators during a force harvest', (t) => {
    const {
      redirect,
      handshake,
      metrics,
      logs,
      sql,
      spanEventAggregator,
      transactionEvents,
      transactionSamples,
      customEvents,
      errorTransactionEvents,
      errorEvents
    } = setupAggregators(true)
    agent.start((err) => {
      t.error(err)
      t.ok(redirect.isDone())
      t.ok(handshake.isDone())
      t.ok(metrics.isDone())
      t.notOk(logs.isDone())
      t.notOk(sql.isDone())
      t.notOk(spanEventAggregator.isDone())
      t.notOk(transactionEvents.isDone())
      t.notOk(transactionSamples.isDone())
      t.notOk(customEvents.isDone())
      t.notOk(errorTransactionEvents.isDone())
      t.notOk(errorEvents.isDone())
      /**
       * cleaning pending calls to avoid the afterEach
       * saying it is clearing pending calls
       * we know these are pending so let's be explicit
       * vs the afterEach which helps us understanding things
       * that need cleaned up
       */
      nock.cleanAll()
      t.end()
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
      error_event_data: 8,
      span_event_data: 200,
      log_event_data: 833
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

  t.test('should generate SpanEventData/HarvestLimit supportability', (t) => {
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/SpanEventData/HarvestLimit'

      const metric = agent.metrics.getMetric(expectedMetricName)

      t.ok(metric)
      t.equal(metric.total, validHarvestConfig.harvest_limits.span_event_data)
      t.end()
    })
  })
  t.test('should generate LogEventData/HarvestLimit supportability', (t) => {
    agent.onConnect(false, () => {
      const expectedMetricName = 'Supportability/EventHarvest/LogEventData/HarvestLimit'

      const metric = agent.metrics.getMetric(expectedMetricName)

      t.ok(metric)
      t.equal(metric.total, validHarvestConfig.harvest_limits.log_event_data)
      t.end()
    })
  })
})

tap.test('logging supportability on connect', (t) => {
  t.autoend()
  let agent
  const keys = ['Forwarding', 'Metrics', 'LocalDecorating']

  t.beforeEach(() => {
    nock.disableNetConnect()
    agent = helper.loadMockedAgent(null, false)
  })
  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('should increment disabled metrics when logging features are off', (t) => {
    agent.config.application_logging.enabled = true
    agent.config.application_logging.metrics.enabled = false
    agent.config.application_logging.forwarding.enabled = false
    agent.config.application_logging.local_decorating.enabled = false
    agent.onConnect(false, () => {
      keys.forEach((key) => {
        const disabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/disabled`)
        const enabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/enabled`)
        t.equal(disabled.callCount, 1)
        t.notOk(enabled)
      })
      t.end()
    })
  })

  t.test(
    'should increment disabled metrics when logging features are on but application_logging.enabled is false',
    (t) => {
      agent.config.application_logging.enabled = false
      agent.config.application_logging.metrics.enabled = true
      agent.config.application_logging.forwarding.enabled = true
      agent.config.application_logging.local_decorating.enabled = true
      agent.onConnect(false, () => {
        keys.forEach((key) => {
          const disabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/disabled`)
          const enabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/enabled`)
          t.equal(disabled.callCount, 1)
          t.notOk(enabled)
        })
        t.end()
      })
    }
  )

  t.test('should increment enabled metrics when logging features are on', (t) => {
    agent.config.application_logging.enabled = true
    agent.config.application_logging.metrics.enabled = true
    agent.config.application_logging.forwarding.enabled = true
    agent.config.application_logging.local_decorating.enabled = true
    agent.onConnect(false, () => {
      keys.forEach((key) => {
        const disabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/disabled`)
        const enabled = agent.metrics.getMetric(`Supportability/Logging/${key}/Nodejs/enabled`)
        t.equal(enabled.callCount, 1)
        t.notOk(disabled)
      })
      t.end()
    })
  })

  t.test('should default llm to an object', (t) => {
    t.same(agent.llm, {})
    t.end()
  })
})

tap.test('getNRLinkingMetadata', (t) => {
  t.autoend()
  let agent

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should properly format the NR-LINKING pipe string', (t) => {
    agent.config.entity_guid = 'unit-test'
    helper.runInTransaction(agent, 'nr-linking-test', (tx) => {
      const nrLinkingMeta = agent.getNRLinkingMetadata()
      const expectedLinkingMeta = ` NR-LINKING|unit-test|${agent.config.getHostnameSafe()}|${
        tx.traceId
      }|${tx.trace.root.id}|New%20Relic%20for%20Node.js%20tests|`
      t.equal(
        nrLinkingMeta,
        expectedLinkingMeta,
        'NR-LINKING metadata should be properly formatted'
      )
      t.end()
    })
  })

  t.test('should properly handle if parts of NR-LINKING are undefined', (t) => {
    const nrLinkingMeta = agent.getNRLinkingMetadata()
    const expectedLinkingMeta = ` NR-LINKING||${agent.config.getHostnameSafe()}|||New%20Relic%20for%20Node.js%20tests|`
    t.equal(nrLinkingMeta, expectedLinkingMeta, 'NR-LINKING metadata should be properly formatted')
    t.end()
  })
})
