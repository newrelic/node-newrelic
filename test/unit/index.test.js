/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const sinon = require('sinon')
const { test } = require('tap')
const proxyquire = require('proxyquire').noCallThru()
const createLoggerMock = require('./mocks/logger')
const createMockAgent = require('./mocks/agent')
const createShimmerMock = require('./mocks/shimmer')
const createMetricsMock = require('./mocks/metrics')

test('loader metrics', (t) => {
  t.autoend()
  let metricsMock
  let MockAgent
  let shimmerMock
  let loggerMock
  let ApiMock
  let sandbox

  t.beforeEach(() => {
    sandbox = sinon.createSandbox()
    metricsMock = createMetricsMock(sandbox)
    MockAgent = createMockAgent(sandbox, metricsMock)
    shimmerMock = createShimmerMock(sandbox)
    loggerMock = createLoggerMock(sandbox)

    ApiMock = function (agent) {
      this.agent = agent
    }
  })

  t.afterEach(() => {
    process.execArgv = []
    sandbox.restore()
    delete require.cache.__NR_cache
  })

  t.test('should load preload metric when agent is loaded via -r', (t) => {
    process.execArgv = ['-r', 'newrelic']
    const agent = proxyquire('../../index', {
      './lib/agent': MockAgent,
      './lib/shimmer': shimmerMock,
      './api': ApiMock
    })

    const metricCall = agent.agent.metrics.getOrCreateMetric

    t.equal(metricCall.args.length, 1)
    t.equal(metricCall.args[0][0], 'Supportability/Features/CJS/Preload')
    t.end()
  })

  t.test('should not load preload metric if -r is present but is not newrelic', (t) => {
    process.execArgv = ['-r', 'some-cool-lib']
    const agent = proxyquire('../../index', {
      './lib/agent': MockAgent,
      './lib/shimmer': shimmerMock,
      './lib/logger': loggerMock,
      './api': ApiMock
    })

    const metricCall = agent.agent.metrics.getOrCreateMetric

    t.equal(metricCall.args.length, 1)
    t.equal(metricCall.args[0][0], 'Supportability/Features/CJS/Require')
    t.match(
      loggerMock.debug.args[4][1],
      /node \-r some-cool-lib.*index\.test\.js/,
      'should log how the agent is called'
    )
    t.end()
  })

  t.test(
    'should detect preload metric if newrelic is one of the -r calls but not the first',
    (t) => {
      process.execArgv = ['-r', 'some-cool-lib', '--inspect', '-r', 'newrelic']
      const agent = proxyquire('../../index', {
        './lib/agent': MockAgent,
        './lib/shimmer': shimmerMock,
        './api': ApiMock
      })

      const metricCall = agent.agent.metrics.getOrCreateMetric

      t.equal(metricCall.args.length, 1)
      t.equal(metricCall.args[0][0], 'Supportability/Features/CJS/Preload')
      t.end()
    }
  )

  t.test('should load preload and require metric if is esm loader and -r to load agent', (t) => {
    process.execArgv = ['--loader', 'newrelic/esm-loader.mjs', '-r', 'newrelic']
    const agent = proxyquire('../../index', {
      './lib/agent': MockAgent,
      './lib/shimmer': shimmerMock,
      './lib/logger': loggerMock,
      './api': ApiMock
    })

    const metricCall = agent.agent.metrics.getOrCreateMetric

    t.equal(metricCall.args.length, 2)
    t.equal(metricCall.args[0][0], 'Supportability/Features/ESM/Loader')
    t.equal(metricCall.args[1][0], 'Supportability/Features/CJS/Preload')
    t.match(
      loggerMock.debug.args[4][1],
      /node \-\-loader newrelic\/esm-loader.mjs \-r newrelic.*index\.test\.js/,
      'should log how the agent is called'
    )
    t.end()
  })

  t.test('should load preload and require metric if esm loader and require  of agent', (t) => {
    process.execArgv = ['--loader', 'newrelic/esm-loader.mjs']
    const agent = proxyquire('../../index', {
      './lib/agent': MockAgent,
      './lib/shimmer': shimmerMock,
      './api': ApiMock
    })

    const metricCall = agent.agent.metrics.getOrCreateMetric

    t.equal(metricCall.args.length, 2)
    t.equal(metricCall.args[0][0], 'Supportability/Features/ESM/Loader')
    t.equal(metricCall.args[1][0], 'Supportability/Features/CJS/Require')
    t.end()
  })

  t.test('should load require metric when agent is required', (t) => {
    const agent = proxyquire('../../index', {
      './lib/agent': MockAgent,
      './lib/shimmer': shimmerMock,
      './api': ApiMock
    })

    const metricCall = agent.agent.metrics.getOrCreateMetric

    t.equal(metricCall.args.length, 1)
    t.equal(metricCall.args[0][0], 'Supportability/Features/CJS/Require')
    t.end()
  })

  t.test('should load enable source map metric when --enable-source-maps is present', (t) => {
    process.execArgv = ['--enable-source-maps']
    const agent = proxyquire('../../index', {
      './lib/agent': MockAgent,
      './lib/shimmer': shimmerMock,
      './api': ApiMock
    })

    const metricCall = agent.agent.metrics.getOrCreateMetric

    t.equal(metricCall.args.length, 2)
    t.equal(metricCall.args[1][0], 'Supportability/Features/EnableSourceMaps')
    t.end()
  })
})

test('index tests', (t) => {
  t.autoend()
  let sandbox
  let loggerMock
  let processVersionStub
  let configMock
  let mockConfig
  let MockAgent
  let k2Stub
  let shimmerMock
  let metricsMock
  let workerThreadsStub

  t.beforeEach(() => {
    sandbox = sinon.createSandbox()
    metricsMock = createMetricsMock(sandbox)
    MockAgent = createMockAgent(sandbox, metricsMock)
    processVersionStub = {
      satisfies: sandbox.stub()
    }
    loggerMock = createLoggerMock(sandbox)
    mockConfig = {
      applications: sandbox.stub(),
      agent_enabled: true,
      logging: {},
      feature_flag: { flag_1: true, flag_2: false },
      security: { agent: { enabled: false } },
      worker_threads: { enabled: false }
    }
    configMock = {
      getOrCreateInstance: sandbox.stub().returns(mockConfig)
    }
    workerThreadsStub = {
      isMainThread: true
    }
    sandbox.stub(console, 'error')
    k2Stub = { start: sandbox.stub() }
    processVersionStub.satisfies.onCall(0).returns(true)
    processVersionStub.satisfies.onCall(1).returns(false)
    mockConfig.applications.returns(['my-app-name'])
    MockAgent.prototype.start.yields(null)
    shimmerMock = createShimmerMock(sandbox)
  })

  function loadIndex() {
    return proxyquire('../../index', {
      'worker_threads': workerThreadsStub,
      './lib/util/process-version': processVersionStub,
      './lib/logger': loggerMock,
      './lib/agent': MockAgent,
      './lib/config': configMock,
      './lib/shimmer': shimmerMock,
      '@newrelic/security-agent': k2Stub
    })
  }

  t.afterEach(() => {
    sandbox.restore()
    delete require.cache.__NR_cache
  })

  t.test('should properly register when agent starts and add appropriate metrics', (t) => {
    const api = loadIndex()
    const version = /^v(\d+)/.exec(process.version)
    t.equal(api.agent.recordSupportability.callCount, 5, 'should log 5 supportability metrics')
    t.equal(api.agent.recordSupportability.args[0][0], `Nodejs/Version/${version[1]}`)
    t.equal(api.agent.recordSupportability.args[1][0], 'Nodejs/FeatureFlag/flag_1/enabled')
    t.equal(api.agent.recordSupportability.args[2][0], 'Nodejs/FeatureFlag/flag_2/disabled')
    t.equal(api.agent.recordSupportability.args[3][0], 'Nodejs/Application/Opening/Duration')
    t.equal(api.agent.recordSupportability.args[4][0], 'Nodejs/Application/Initialization/Duration')
    api.agent.emit('started')
    t.equal(api.agent.recordSupportability.args[5][0], 'Nodejs/Application/Registration/Duration')
    t.equal(k2Stub.start.callCount, 0, 'should not register security agent')
    t.equal(loggerMock.debug.callCount, 6, 'should log 6 debug messages')
    t.end()
  })

  t.test('should set api on require.cache.__NR_cache', (t) => {
    const api = loadIndex()
    t.same(require.cache.__NR_cache, api)
    t.end()
  })

  t.test('should load k2 agent if config.security.agent.enabled', (t) => {
    mockConfig.security.agent.enabled = true
    const api = loadIndex()
    t.equal(k2Stub.start.callCount, 1, 'should register security agent')
    t.same(k2Stub.start.args[0][0], api, 'should call start on security agent with proper args')
    t.end()
  })

  t.test('should record double load when NR_cache and agent exist on NR_cache', (t) => {
    const mockAgent = new MockAgent()
    require.cache.__NR_cache = { agent: mockAgent }
    loadIndex()
    t.equal(mockAgent.recordSupportability.callCount, 1, 'should record double load')
    t.equal(mockAgent.recordSupportability.args[0][0], 'Agent/DoubleLoad')
    t.equal(loggerMock.debug.callCount, 0)
    t.end()
  })

  t.test('should throw error if using an unsupported version of Node.js', (t) => {
    processVersionStub.satisfies.onCall(0).returns(false)
    loadIndex()
    t.equal(loggerMock.error.callCount, 1, 'should log an error')
    t.match(loggerMock.error.args[0][0], /New Relic for Node.js requires a version of Node/)
    t.end()
  })

  t.test('should log warning if using an odd version of node', (t) => {
    processVersionStub.satisfies.onCall(0).returns(true)
    processVersionStub.satisfies.onCall(1).returns(true)
    configMock.getOrCreateInstance.returns(null)
    loadIndex()
    t.equal(loggerMock.warn.callCount, 1, 'should log an error')
    t.match(loggerMock.warn.args[0][0], /New Relic for Node\.js.*has not been tested on Node/)
    t.end()
  })

  t.test('should use stub api if no config detected', (t) => {
    configMock.getOrCreateInstance.returns(null)
    processVersionStub.satisfies.onCall(0).returns(true)
    processVersionStub.satisfies.onCall(1).returns(false)
    const api = loadIndex()
    t.equal(loggerMock.info.callCount, 2, 'should log info logs')
    t.equal(loggerMock.info.args[1][0], 'No configuration detected. Not starting.')
    t.equal(api.constructor.name, 'Stub')
    t.end()
  })

  t.test('should use stub api if agent_enabled is false', (t) => {
    configMock.getOrCreateInstance.returns({ agent_enabled: false })
    processVersionStub.satisfies.onCall(0).returns(true)
    processVersionStub.satisfies.onCall(1).returns(false)
    const api = loadIndex()
    t.equal(loggerMock.info.callCount, 2, 'should log info logs')
    t.equal(loggerMock.info.args[1][0], 'Module disabled in configuration. Not starting.')
    t.equal(api.constructor.name, 'Stub')
    t.end()
  })

  t.test('should log warning when logging diagnostics is enabled', (t) => {
    mockConfig.logging.diagnostics = true
    processVersionStub.satisfies.onCall(0).returns(true)
    processVersionStub.satisfies.onCall(1).returns(false)
    loadIndex()
    t.equal(
      loggerMock.warn.args[0][0],
      'Diagnostics logging is enabled, this may cause significant overhead.'
    )
    t.end()
  })

  t.test('should throw error is app name is not set in config', (t) => {
    processVersionStub.satisfies.onCall(0).returns(true)
    processVersionStub.satisfies.onCall(1).returns(false)
    mockConfig.applications.returns([])
    loadIndex()
    t.equal(loggerMock.error.callCount, 1, 'should log an error')
    t.match(loggerMock.error.args[0][0], /New Relic requires that you name this application!/)
    t.end()
  })

  t.test('should log error if agent startup failed', (t) => {
    processVersionStub.satisfies.onCall(0).returns(true)
    processVersionStub.satisfies.onCall(1).returns(false)
    mockConfig.applications.returns(['my-app-name'])
    const err = new Error('agent start failed')
    MockAgent.prototype.start.yields(err)
    loadIndex()
    t.equal(loggerMock.error.callCount, 1, 'should log a startup error')
    t.equal(loggerMock.error.args[0][1], 'New Relic for Node.js halted startup due to an error:')
    t.end()
  })

  t.test('should log warning if not in main thread and make a stub api', (t) => {
    workerThreadsStub.isMainThread = false
    const api = loadIndex()
    t.equal(loggerMock.warn.callCount, 1)
    t.equal(
      loggerMock.warn.args[0][0],
      'New Relic for Node.js in worker_threads is not officially supported. Not starting! To bypass this, set `config.worker_threads.enabled` to true in configuration.'
    )
    t.not(api.agent, 'should not initialize an agent')
    t.equal(api.constructor.name, 'Stub')
    t.end()
  })

  t.test(
    'should log warning if not in main thread and worker_threads.enabled is true and init agent',
    (t) => {
      mockConfig.worker_threads.enabled = true
      workerThreadsStub.isMainThread = false
      const api = loadIndex()
      t.equal(loggerMock.warn.callCount, 1)
      t.equal(
        loggerMock.warn.args[0][0],
        'Attempting to load agent in worker thread. This is not officially supported. Use at your own risk.'
      )
      t.ok(api.agent)
      t.equal(api.agent.constructor.name, 'MockAgent', 'should initialize an agent')
      t.equal(api.constructor.name, 'API')
      t.end()
    }
  )
})
