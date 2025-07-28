/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const tspl = require('@matteo.collina/tspl')

const sinon = require('sinon')

const HealthReporter = require('#agentlib/health-reporter.js')
const proxyquire = require('proxyquire').noCallThru()
const createLoggerMock = require('./mocks/logger')
const createMockAgent = require('./mocks/agent')
const createShimmerMock = require('./mocks/shimmer')
const createMetricsMock = require('./mocks/metrics')

test('loader metrics', async (t) => {
  t.beforeEach((ctx) => {
    const sandbox = sinon.createSandbox()
    const metricsMock = createMetricsMock(sandbox)
    const MockAgent = createMockAgent(sandbox, metricsMock)
    const shimmerMock = createShimmerMock(sandbox)
    const loggerMock = createLoggerMock(sandbox)

    const ApiMock = function (agent) {
      this.agent = agent
    }

    ctx.nr = {
      sandbox,
      metricsMock,
      MockAgent,
      shimmerMock,
      loggerMock,
      ApiMock
    }
  })

  t.afterEach((ctx) => {
    process.execArgv = []
    ctx.nr.sandbox.restore()
    delete require.cache.__NR_cache
  })

  await test('should load preload metric when agent is loaded via -r', (t) => {
    process.execArgv = ['-r', 'newrelic']
    const agent = proxyquire('../../index', {
      './lib/agent': t.nr.MockAgent,
      './lib/shimmer': t.nr.shimmerMock,
      './api': t.nr.ApiMock
    })
    const metricCall = agent.agent.metrics.getOrCreateMetric

    assert.equal(metricCall.args.length, 1)
    assert.equal(metricCall.args[0][0], 'Supportability/Features/CJS/Preload')
  })

  await t.test('should not load preload metric if -r is present but is not newrelic', (t) => {
    process.execArgv = ['-r', 'some-cool-lib']
    const agent = proxyquire('../../index', {
      './lib/agent': t.nr.MockAgent,
      './lib/shimmer': t.nr.shimmerMock,
      './lib/logger': t.nr.loggerMock,
      './api': t.nr.ApiMock
    })

    const metricCall = agent.agent.metrics.getOrCreateMetric

    assert.equal(metricCall.args.length, 1)
    assert.equal(metricCall.args[0][0], 'Supportability/Features/CJS/Require')
    assert.match(
      t.nr.loggerMock.debug.args[4][1],
      /node -r some-cool-lib.*index\.test\.js/,
      'should log how the agent is called'
    )
  })

  await t.test(
    'should detect preload metric if newrelic is one of the -r calls but not the first',
    (t) => {
      process.execArgv = ['-r', 'some-cool-lib', '--inspect', '-r', 'newrelic']
      const agent = proxyquire('../../index', {
        './lib/agent': t.nr.MockAgent,
        './lib/shimmer': t.nr.shimmerMock,
        './api': t.nr.ApiMock
      })

      const metricCall = agent.agent.metrics.getOrCreateMetric

      assert.equal(metricCall.args.length, 1)
      assert.equal(metricCall.args[0][0], 'Supportability/Features/CJS/Preload')
    }
  )

  await t.test(
    'should load preload and require metric if is esm loader and -r to load agent',
    (t) => {
      process.execArgv = ['--loader', 'newrelic/esm-loader.mjs', '-r', 'newrelic']
      const agent = proxyquire('../../index', {
        './lib/agent': t.nr.MockAgent,
        './lib/shimmer': t.nr.shimmerMock,
        './lib/logger': t.nr.loggerMock,
        './api': t.nr.ApiMock
      })

      const metricCall = agent.agent.metrics.getOrCreateMetric

      assert.equal(metricCall.args.length, 2)
      assert.equal(metricCall.args[0][0], 'Supportability/Features/ESM/Loader')
      assert.equal(metricCall.args[1][0], 'Supportability/Features/CJS/Preload')
      assert.match(
        t.nr.loggerMock.debug.args[4][1],
        /node --loader newrelic\/esm-loader.mjs -r newrelic.*index\.test\.js/,
        'should log how the agent is called'
      )
    }
  )

  await t.test(
    'should load preload and require metric if esm loader and require  of agent',
    (t) => {
      process.execArgv = ['--loader', 'newrelic/esm-loader.mjs']
      const agent = proxyquire('../../index', {
        './lib/agent': t.nr.MockAgent,
        './lib/shimmer': t.nr.shimmerMock,
        './api': t.nr.ApiMock
      })

      const metricCall = agent.agent.metrics.getOrCreateMetric

      assert.equal(metricCall.args.length, 2)
      assert.equal(metricCall.args[0][0], 'Supportability/Features/ESM/Loader')
      assert.equal(metricCall.args[1][0], 'Supportability/Features/CJS/Require')
    }
  )

  await t.test('should load require metric when agent is required', (t) => {
    const agent = proxyquire('../../index', {
      './lib/agent': t.nr.MockAgent,
      './lib/shimmer': t.nr.shimmerMock,
      './api': t.nr.ApiMock
    })

    const metricCall = agent.agent.metrics.getOrCreateMetric

    assert.equal(metricCall.args.length, 1)
    assert.equal(metricCall.args[0][0], 'Supportability/Features/CJS/Require')
  })

  await t.test('should load enable source map metric when --enable-source-maps is present', (t) => {
    process.execArgv = ['--enable-source-maps']
    const agent = proxyquire('../../index', {
      './lib/agent': t.nr.MockAgent,
      './lib/shimmer': t.nr.shimmerMock,
      './api': t.nr.ApiMock
    })

    const metricCall = agent.agent.metrics.getOrCreateMetric

    assert.equal(metricCall.args.length, 2)
    assert.equal(metricCall.args[1][0], 'Supportability/Features/EnableSourceMaps')
  })
})

test('index tests', async (t) => {
  t.beforeEach((ctx) => {
    const sandbox = sinon.createSandbox()
    const metricsMock = createMetricsMock(sandbox)
    const MockAgent = createMockAgent(sandbox, metricsMock)
    const processVersionStub = { satisfies: sandbox.stub() }
    const loggerMock = createLoggerMock(sandbox)
    const mockConfig = {
      applications: sandbox.stub(),
      agent_enabled: true,
      instrumentation: {
        foo: { enabled: false },
        bar: { enabled: false },
        enabled: { enabled: true }
      },
      logging: {},
      feature_flag: { flag_1: true, flag_2: false },
      security: { agent: { enabled: false } },
      worker_threads: { enabled: false }
    }
    const configMock = {
      getOrCreateInstance: sandbox.stub().returns(mockConfig)
    }
    const workerThreadsStub = { isMainThread: true }
    const k2Stub = { start: sandbox.stub() }

    sandbox.stub(console, 'error')
    processVersionStub.satisfies.onCall(0).returns(true)
    processVersionStub.satisfies.onCall(1).returns(false)
    mockConfig.applications.returns(['my-app-name'])
    MockAgent.prototype.start.yields(null)
    const shimmerMock = createShimmerMock(sandbox)

    ctx.nr = {
      sandbox,
      metricsMock,
      MockAgent,
      processVersionStub,
      loggerMock,
      mockConfig,
      configMock,
      workerThreadsStub,
      k2Stub,
      shimmerMock
    }
  })

  t.afterEach((ctx) => {
    ctx.nr.sandbox.restore()
    delete require.cache.__NR_cache
  })

  function loadIndex(ctx) {
    return proxyquire('../../index', {
      worker_threads: ctx.nr.workerThreadsStub,
      './lib/util/process-version': ctx.nr.processVersionStub,
      './lib/logger': ctx.nr.loggerMock,
      './lib/agent': ctx.nr.MockAgent,
      './lib/config': ctx.nr.configMock,
      './lib/shimmer': ctx.nr.shimmerMock,
      '@newrelic/security-agent': ctx.nr.k2Stub
    })
  }

  await t.test('should properly register when agent starts and add appropriate metrics', (t) => {
    const api = loadIndex(t)
    const version = /^v(\d+)/.exec(process.version)
    assert.equal(api.agent.recordSupportability.callCount, 7, 'should log 5 supportability metrics')
    assert.equal(api.agent.recordSupportability.args[0][0], `Nodejs/Version/${version[1]}`)
    assert.equal(api.agent.recordSupportability.args[1][0], 'Nodejs/FeatureFlag/flag_1/enabled')
    assert.equal(api.agent.recordSupportability.args[2][0], 'Nodejs/FeatureFlag/flag_2/disabled')
    assert.equal(api.agent.recordSupportability.args[3][0], 'Nodejs/Instrumentation/foo/disabled')
    assert.equal(api.agent.recordSupportability.args[4][0], 'Nodejs/Instrumentation/bar/disabled')
    assert.equal(api.agent.recordSupportability.args[5][0], 'Nodejs/Application/Opening/Duration')
    assert.equal(
      api.agent.recordSupportability.args[6][0],
      'Nodejs/Application/Initialization/Duration'
    )
    api.agent.emit('started')
    assert.equal(
      api.agent.recordSupportability.args[7][0],
      'Nodejs/Application/Registration/Duration'
    )
    assert.equal(t.nr.k2Stub.start.callCount, 0, 'should not register security agent')
    assert.equal(t.nr.loggerMock.debug.callCount, 6, 'should log 6 debug messages')
  })

  await t.test('should set api on require.cache.__NR_cache', (t) => {
    const api = loadIndex(t)
    assert.deepEqual(require.cache.__NR_cache, api)
  })

  await t.test('should load k2 agent if config.security.agent.enabled', (t) => {
    t.nr.mockConfig.security.agent.enabled = true
    const api = loadIndex(t)
    assert.equal(t.nr.k2Stub.start.callCount, 1, 'should register security agent')
    assert.deepEqual(
      t.nr.k2Stub.start.args[0][0],
      api,
      'should call start on security agent with proper args'
    )
  })

  await t.test('should record double load when NR_cache and agent exist on NR_cache', (t) => {
    const mockAgent = new t.nr.MockAgent()
    require.cache.__NR_cache = { agent: mockAgent }
    loadIndex(t)
    assert.equal(mockAgent.recordSupportability.callCount, 1, 'should record double load')
    assert.equal(mockAgent.recordSupportability.args[0][0], 'Agent/DoubleLoad')
    assert.equal(t.nr.loggerMock.debug.callCount, 0)
  })

  await t.test('should throw error if using an unsupported version of Node.js', (t) => {
    t.nr.processVersionStub.satisfies.onCall(0).returns(false)
    loadIndex(t)
    assert.equal(t.nr.loggerMock.error.callCount, 1, 'should log an error')
    assert.match(
      t.nr.loggerMock.error.args[0][0].message,
      /New Relic for Node.js requires a version of Node/
    )
  })

  await t.test('should log warning if using an odd version of node', (t) => {
    t.nr.processVersionStub.satisfies.onCall(0).returns(true)
    t.nr.processVersionStub.satisfies.onCall(1).returns(true)
    t.nr.configMock.getOrCreateInstance.returns(null)
    loadIndex(t)
    assert.equal(t.nr.loggerMock.warn.callCount, 1, 'should log an error')
    assert.match(
      t.nr.loggerMock.warn.args[0][0],
      /New Relic for Node\.js.*has not been tested on Node/
    )
  })

  await t.test('should use stub api if no config detected', (t) => {
    t.nr.configMock.getOrCreateInstance.returns(null)
    t.nr.processVersionStub.satisfies.onCall(0).returns(true)
    t.nr.processVersionStub.satisfies.onCall(1).returns(false)
    const api = loadIndex(t)
    assert.equal(t.nr.loggerMock.info.callCount, 2, 'should log info logs')
    assert.equal(t.nr.loggerMock.info.args[1][0], 'No configuration detected. Not starting.')
    assert.equal(api.constructor.name, 'Stub')
  })

  await t.test('should use stub api if agent_enabled is false', (t) => {
    t.nr.configMock.getOrCreateInstance.returns({ agent_enabled: false })
    t.nr.processVersionStub.satisfies.onCall(0).returns(true)
    t.nr.processVersionStub.satisfies.onCall(1).returns(false)
    const api = loadIndex(t)
    assert.equal(t.nr.loggerMock.info.callCount, 2, 'should log info logs')
    assert.equal(t.nr.loggerMock.info.args[1][0], 'Module disabled in configuration. Not starting.')
    assert.equal(api.constructor.name, 'Stub')
  })

  await t.test('should log warning when logging diagnostics is enabled', (t) => {
    t.nr.mockConfig.logging.diagnostics = true
    t.nr.processVersionStub.satisfies.onCall(0).returns(true)
    t.nr.processVersionStub.satisfies.onCall(1).returns(false)
    loadIndex(t)
    assert.equal(
      t.nr.loggerMock.warn.args[0][0],
      'Diagnostics logging is enabled, this may cause significant overhead.'
    )
  })

  await t.test('should throw error is app name is not set in config', async (t) => {
    const plan = tspl(t, { plan: 3 })
    const setStatus = HealthReporter.prototype.setStatus
    HealthReporter.prototype.setStatus = (status) => {
      plan.equal(status, HealthReporter.STATUS_MISSING_APP_NAME)
    }
    t.after(() => {
      HealthReporter.prototype.setStatus = setStatus
    })

    t.nr.processVersionStub.satisfies.onCall(0).returns(true)
    t.nr.processVersionStub.satisfies.onCall(1).returns(false)
    t.nr.mockConfig.applications.returns([])
    loadIndex(t)
    plan.equal(t.nr.loggerMock.error.callCount, 1, 'should log an error')
    plan.match(
      t.nr.loggerMock.error.args[0][0].message,
      /New Relic requires that you name this application!/
    )

    await plan.completed
  })

  await t.test('should log error if agent startup failed', async (t) => {
    const plan = tspl(t, { plan: 3 })
    const setStatus = HealthReporter.prototype.setStatus
    HealthReporter.prototype.setStatus = (status) => {
      plan.equal(status, HealthReporter.STATUS_INTERNAL_UNEXPECTED_ERROR)
    }
    t.after(() => {
      HealthReporter.prototype.setStatus = setStatus
    })

    t.nr.processVersionStub.satisfies.onCall(0).returns(true)
    t.nr.processVersionStub.satisfies.onCall(1).returns(false)
    t.nr.mockConfig.applications.returns(['my-app-name'])
    const err = new Error('agent start failed')
    t.nr.MockAgent.prototype.start.yields(err)
    loadIndex(t)
    plan.equal(t.nr.loggerMock.error.callCount, 1, 'should log a startup error')
    plan.equal(
      t.nr.loggerMock.error.args[0][1],
      'New Relic for Node.js halted startup due to an error:'
    )

    await plan.completed
  })

  await t.test('should log warning if not in main thread and make a stub api', (t) => {
    t.nr.workerThreadsStub.isMainThread = false
    const api = loadIndex(t)
    assert.equal(t.nr.loggerMock.warn.callCount, 1)
    assert.equal(
      t.nr.loggerMock.warn.args[0][0],
      'New Relic for Node.js in worker_threads is not officially supported. Not starting! To bypass this, set `config.worker_threads.enabled` to true in configuration.'
    )
    assert.equal(api.agent, undefined, 'should not initialize an agent')
    assert.equal(api.constructor.name, 'Stub')
  })

  await t.test(
    'should log warning if not in main thread and worker_threads.enabled is true and init agent',
    (t) => {
      t.nr.mockConfig.worker_threads.enabled = true
      t.nr.workerThreadsStub.isMainThread = false
      const api = loadIndex(t)
      assert.equal(t.nr.loggerMock.warn.callCount, 1)
      assert.equal(
        t.nr.loggerMock.warn.args[0][0],
        'Attempting to load agent in worker thread. This is not officially supported. Use at your own risk.'
      )
      assert.ok(api.agent)
      assert.equal(api.agent.constructor.name, 'MockAgent', 'should initialize an agent')
      assert.equal(api.constructor.name, 'API')
    }
  )
})
