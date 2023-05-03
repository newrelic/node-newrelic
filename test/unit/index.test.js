/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { test } = require('tap')
const proxyquire = require('proxyquire').noCallThru()
const sinon = require('sinon')
const createLoggerMock = require('./mocks/logger')
const createMockAgent = require('./mocks/agent')

test('index tests', (t) => {
  t.autoend()
  let sandbox
  let loggerMock
  let processVersionStub
  let configMock
  let mockConfig
  let MockAgent
  let k2Stub

  t.beforeEach(() => {
    sandbox = sinon.createSandbox()
    MockAgent = createMockAgent(sandbox)
    processVersionStub = {
      satisfies: sandbox.stub()
    }
    loggerMock = createLoggerMock(sandbox)
    mockConfig = {
      applications: sandbox.stub(),
      agent_enabled: true,
      logging: {},
      feature_flag: { flag_1: true, flag_2: false },
      security: { agent: { enabled: false } }
    }
    configMock = {
      getOrCreateInstance: sandbox.stub().returns(mockConfig)
    }
    sandbox.stub(console, 'error')
    k2Stub = { start: sandbox.stub() }
    processVersionStub.satisfies.onCall(0).returns(true)
    processVersionStub.satisfies.onCall(1).returns(false)
    mockConfig.applications.returns(['my-app-name'])
    MockAgent.prototype.start.yields(null)
  })

  function loadIndex() {
    return proxyquire('../../index', {
      './lib/util/process-version': processVersionStub,
      './lib/logger': loggerMock,
      './lib/agent': MockAgent,
      './lib/config': configMock,
      './lib/shimmer': { patchModule: sandbox.stub(), bootstrapInstrumentation: sandbox.stub() },
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
    t.equal(api.agent.recordSupportability.callCount, 5, 'should log 3 supportability metrics')
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
    loadIndex()
    t.equal(k2Stub.start.callCount, 1, 'should register security agent')
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
    loadIndex()
    t.equal(loggerMock.info.callCount, 2, 'should log info logs')
    t.equal(loggerMock.info.args[1][0], 'No configuration detected. Not starting.')
    t.end()
  })

  t.test('should use stub api if agent_enabled is false', (t) => {
    configMock.getOrCreateInstance.returns({ agent_enabled: false })
    processVersionStub.satisfies.onCall(0).returns(true)
    processVersionStub.satisfies.onCall(1).returns(false)
    loadIndex()
    t.equal(loggerMock.info.callCount, 2, 'should log info logs')
    t.equal(loggerMock.info.args[1][0], 'Module disabled in configuration. Not starting.')
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
})
