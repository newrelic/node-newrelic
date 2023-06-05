/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

tap.test('loader metrics', (t) => {
  t.autoend()
  let metricsMock
  let MockAgent
  let shimmerMock
  let ApiMock
  let sandbox

  t.beforeEach(() => {
    sandbox = sinon.createSandbox()
    metricsMock = require('./mocks/metrics')(sandbox)
    MockAgent = require('./mocks/agent')(sandbox, metricsMock)
    shimmerMock = require('./mocks/shimmer')(sandbox)

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
      './api': ApiMock
    })

    const metricCall = agent.agent.metrics.getOrCreateMetric

    t.equal(metricCall.args.length, 1)
    t.equal(metricCall.args[0][0], 'Supportability/Features/CJS/Require')
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

  t.test('should not load preload nor require metric is esm loader loads agent', (t) => {
    metricsMock.getMetric.withArgs('Supportability/Features/ESM/Loader').returns(true)
    const agent = proxyquire('../../index', {
      './lib/agent': MockAgent,
      './lib/shimmer': shimmerMock,
      './api': ApiMock
    })

    const metricCall = agent.agent.metrics.getOrCreateMetric

    t.equal(metricCall.args.length, 0)
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
