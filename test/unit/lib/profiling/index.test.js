/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { describe, test } = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const ProfilingManager = require('#agentlib/profiling/index.js')

test.beforeEach((ctx) => {
  const sandbox = sinon.createSandbox()
  const logger = require('../../mocks/logger')(sandbox)
  const agent = {
    config: {
      profiling: {
        enabled: true,
        include: []
      }
    }
  }
  const cpuProfiler = {
    name: 'cpu',
    start: sandbox.stub(),
    stop: sandbox.stub(),
    collect: sandbox.stub()
  }

  const heapProfiler = {
    name: 'heap',
    start: sandbox.stub(),
    stop: sandbox.stub(),
    collect: sandbox.stub()
  }
  ctx.nr = {
    agent,
    cpuProfiler,
    heapProfiler,
    logger,
    sandbox
  }
})

test.afterEach((ctx) => {
  ctx.nr.sandbox.restore()
})

describe('constructor', () => {
  test('should initialize with agent config', (t) => {
    const { agent } = t.nr
    const profilingManager = new ProfilingManager(agent)

    assert.ok(profilingManager.config, 'should have config')
    assert.deepStrictEqual(profilingManager.config, t.nr.agent.config, 'should store agent config')
  })

  test('should initialize empty profilers array', (t) => {
    const { agent } = t.nr
    const profilingManager = new ProfilingManager(agent)

    assert.ok(Array.isArray(profilingManager.profilers), 'profilers should be an array')
    assert.strictEqual(profilingManager.profilers.length, 0, 'profilers array should be empty')
  })

  test('should call register method', (t) => {
    const { agent, sandbox } = t.nr
    const registerSpy = sandbox.spy(ProfilingManager.prototype, 'register')
    const profilingManager = new ProfilingManager(agent)
    assert.ok(profilingManager)

    assert.ok(registerSpy.calledOnce, 'register should be called once')
  })
})

describe('register', () => {
  test('should be a no-op by default', (t) => {
    const { agent } = t.nr
    const profilingManager = new ProfilingManager(agent)

    profilingManager.register()

    assert.strictEqual(profilingManager.profilers.length, 0, 'should not add any profilers')
  })
})

describe('start', () => {
  test('should warn when no profilers are registered', (t) => {
    const { agent, logger } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })

    profilingManager.start()

    assert.equal(logger.warn.callCount, 1)
    assert.ok(
      logger.warn.calledWith(
        'No profilers have been included in `config.profiling.include`, not starting any profilers.'
      )
    )
  })

  test('should start all registered profilers', (t) => {
    const { agent, cpuProfiler, heapProfiler, logger } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })
    profilingManager.profilers = [cpuProfiler, heapProfiler]
    profilingManager.start()

    assert.equal(cpuProfiler.start.callCount, 1)
    assert.equal(heapProfiler.start.callCount, 1)
    assert.ok(
      logger.debug.calledWith('Starting cpu'),
      'should log starting cpu profiler'
    )
    assert.ok(
      logger.debug.calledWith('Starting heap'),
      'should log starting heap profiler'
    )
  })
})

describe('stop', () => {
  test('should warn when no profilers are registered', (t) => {
    const { agent, logger } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })
    profilingManager.stop()

    assert.equal(logger.warn.callCount, 1)
    assert.ok(
      logger.warn.calledWith(
        'No profilers have been included in `config.profiling.include`, not stopping any profilers.'
      )
    )
  })

  test('should stop all registered profilers', (t) => {
    const { agent, cpuProfiler, heapProfiler, logger } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })
    profilingManager.profilers = [cpuProfiler, heapProfiler]
    profilingManager.stop()

    assert.equal(cpuProfiler.stop.callCount, 1)
    assert.equal(heapProfiler.stop.callCount, 1)
    assert.ok(logger.debug.calledWith('Stopping cpu'))
    assert.ok(logger.debug.calledWith('Stopping heap'))
  })
})

describe('collect', (t) => {
  test('should warn and return empty array when no profilers are registered', (t) => {
    const { agent, logger } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })

    const results = profilingManager.collect()
    assert.equal(results.length, 0, 'should return empty array')
    assert.equal(logger.warn.callCount, 1)
    assert.ok(
      logger.warn.calledWith(
        'No profilers have been included in `config.profiling.include`, not collecting any profiling data.'
      )
    )
  })

  test('should collect data from all registered profilers', (t) => {
    const { agent, cpuProfiler, heapProfiler, logger } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })

    const expectedCpuData = { type: 'cpu', data: Buffer.from('cpu-profile-data') }
    const expectedHeapData = { type: 'heap', data: Buffer.from('heap-profile-data') }
    cpuProfiler.collect.returns(expectedCpuData)
    heapProfiler.collect.returns(expectedHeapData)
    profilingManager.profilers = [cpuProfiler, heapProfiler]
    const results = profilingManager.collect()
    assert.equal(results.length, 2, 'should return array with two items')
    const [cpuData, heapData] = results
    assert.equal(cpuProfiler.collect.callCount, 1)
    assert.equal(heapProfiler.collect.callCount, 1)
    assert.deepStrictEqual(cpuData, expectedCpuData)
    assert.deepStrictEqual(heapData, expectedHeapData)
    assert.ok(logger.debug.calledWith('Collecting profiling data for cpu'))
    assert.ok(logger.debug.calledWith('Collecting profiling data for heap'))
  })

  test('should handle profilers returning undefined or null', (t) => {
    const { agent, cpuProfiler, heapProfiler, logger } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })

    const expectedCpuData = undefined
    const expectedHeapData = null
    cpuProfiler.collect.returns(expectedCpuData)
    heapProfiler.collect.returns(expectedHeapData)
    profilingManager.profilers = [cpuProfiler, heapProfiler]
    const results = profilingManager.collect()
    assert.equal(results.length, 2, 'should return array with two items')
    const [cpuData, heapData] = results
    assert.equal(cpuProfiler.collect.callCount, 1)
    assert.equal(heapProfiler.collect.callCount, 1)
    assert.deepStrictEqual(cpuData, expectedCpuData)
    assert.deepStrictEqual(heapData, expectedHeapData)
    assert.ok(logger.debug.calledWith('Collecting profiling data for cpu'))
    assert.ok(logger.debug.calledWith('Collecting profiling data for heap'))
  })

  test('should handle profilers returning null', (t) => {
    const profilingManager = new ProfilingManager(t.nr.agent)

    const mockProfiler = {
      name: 'test-profiler',
      start: sinon.stub(),
      stop: sinon.stub(),
      collect: sinon.stub().returns(null)
    }

    profilingManager.profilers.push(mockProfiler)
    const results = profilingManager.collect()

    assert.ok(Array.isArray(results), 'should return an array')
    assert.strictEqual(results.length, 1, 'should include the null result')
    assert.strictEqual(results[0], null, 'should include null value')
  })
})
