/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { describe, test } = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const ProfilingManager = require('#agentlib/profiling/index.js')
const createProfiler = require('../../mocks/profiler')
const helper = require('#testlib/agent_helper.js')

test.beforeEach((ctx) => {
  const sandbox = sinon.createSandbox()
  const logger = require('../../mocks/logger')(sandbox)
  const agent = helper.loadMockedAgent({
    profiling: {
      enabled: true,
      include: []
    }
  })

  const cpuProfiler = createProfiler({ sandbox, name: 'cpu' })
  const heapProfiler = createProfiler({ sandbox, name: 'heap' })
  ctx.nr = {
    agent,
    cpuProfiler,
    heapProfiler,
    logger,
    sandbox
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.sandbox.restore()
})

describe('constructor', () => {
  test('should initialize with agent config', (t) => {
    const { agent } = t.nr
    const profilingManager = new ProfilingManager(agent)

    assert.ok(profilingManager.config, 'should have config')
    assert.deepStrictEqual(profilingManager.config, t.nr.agent.config.profiling, 'should store agent config')
  })

  test('should initialize empty profilers map', (t) => {
    const { agent } = t.nr
    const profilingManager = new ProfilingManager(agent)

    assert.strictEqual(profilingManager.profilers.size, 0, 'profilers map should be empty')
  })
})

describe('register', () => {
  test('should be a no-op by default', (t) => {
    const { agent } = t.nr
    const profilingManager = new ProfilingManager(agent)

    profilingManager.register()

    assert.strictEqual(profilingManager.profilers.size, 0, 'should not add any profilers')
  })

  test('should register the heap and cpu profilers only once', (t) => {
    const { agent } = t.nr
    const profilingManager = new ProfilingManager(agent)
    profilingManager.config.include = ['heap']

    profilingManager.register()
    assert.strictEqual(profilingManager.profilers.size, 1, 'should only add heap profiler')
    profilingManager.register()
    assert.strictEqual(profilingManager.profilers.size, 1, 'should be a no-op')
    profilingManager.config.include = ['heap', 'cpu']
    profilingManager.register()
    assert.strictEqual(profilingManager.profilers.size, 2, 'should only add cpu to the already registered profilers: heap')
    profilingManager.register()
    assert.strictEqual(profilingManager.profilers.size, 2, 'should be a no-op')
  })
})

describe('start', () => {
  test('should warn when no profilers are registered', (t) => {
    const { agent, logger } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })

    const started = profilingManager.start()
    assert.equal(started, false)

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
    profilingManager.profilers.set('cpu', cpuProfiler)
    profilingManager.profilers.set('heap', heapProfiler)
    const started = profilingManager.start()
    assert.equal(started, true)
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
    assert.ok(profilingManager.startTime, 'should set startedAt time when profilers are started')
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
    profilingManager.profilers.set('cpu', cpuProfiler)
    profilingManager.profilers.set('heap', heapProfiler)
    profilingManager.stop()

    assert.equal(cpuProfiler.stop.callCount, 1)
    assert.equal(heapProfiler.stop.callCount, 1)
    assert.ok(logger.debug.calledWith('Stopping cpu'))
    assert.ok(logger.debug.calledWith('Stopping heap'))
  })

  test('should log supportability metric for profiling duration', (t) => {
    const { agent, cpuProfiler, heapProfiler, logger, sandbox } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })
    profilingManager.profilers.set('cpu', cpuProfiler)
    profilingManager.profilers.set('heap', heapProfiler)

    const startTime = 1000
    const stopTime = 3000
    profilingManager.startTime = startTime
    sandbox.stub(Date, 'now').returns(stopTime)

    profilingManager.stop()

    const metrics = agent.metrics._metrics.unscoped
    assert.ok(metrics['Supportability/Nodejs/Profiling/Duration'], 'should have profiling duration supportability metric')
    assert.equal(metrics['Supportability/Nodejs/Profiling/Duration'].total, (stopTime - startTime) / 1000)
  })
})

describe('collect', (t) => {
  test('should warn and return empty array when no profilers are registered', async (t) => {
    const { agent, logger } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })

    const results = await profilingManager.collect()
    assert.equal(results.length, 0, 'should return empty array')
    assert.equal(logger.warn.callCount, 1)
    assert.ok(
      logger.warn.calledWith(
        'No profilers have been included in `config.profiling.include`, not collecting any profiling data.'
      )
    )
  })

  test('should collect data from all registered profilers', async (t) => {
    const { agent, cpuProfiler, heapProfiler, logger } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })

    const expectedCpuData = { type: 'cpu', data: Buffer.from('cpu-profile-data') }
    const expectedHeapData = { type: 'heap', data: Buffer.from('heap-profile-data') }
    cpuProfiler.collect.resolves(expectedCpuData)
    heapProfiler.collect.resolves(expectedHeapData)
    profilingManager.profilers.set('cpu', cpuProfiler)
    profilingManager.profilers.set('heap', heapProfiler)
    const results = await profilingManager.collect()
    assert.equal(results.length, 2, 'should return array with two items')
    const [cpuData, heapData] = results
    assert.equal(cpuProfiler.collect.callCount, 1)
    assert.equal(heapProfiler.collect.callCount, 1)
    assert.deepStrictEqual(cpuData, expectedCpuData)
    assert.deepStrictEqual(heapData, expectedHeapData)
    assert.ok(logger.debug.calledWith('Collecting profiling data for cpu'))
    assert.ok(logger.debug.calledWith('Collecting profiling data for heap'))
  })

  test('should handle profilers returning undefined or null', async (t) => {
    const { agent, cpuProfiler, heapProfiler, logger } = t.nr
    const profilingManager = new ProfilingManager(agent, { logger })

    const expectedCpuData = undefined
    const expectedHeapData = null
    cpuProfiler.collect.resolves(expectedCpuData)
    heapProfiler.collect.resolves(expectedHeapData)
    profilingManager.profilers.set('cpu', cpuProfiler)
    profilingManager.profilers.set('heap', heapProfiler)
    const results = await profilingManager.collect()
    assert.equal(results.length, 2, 'should return array with two items')
    const [cpuData, heapData] = results
    assert.equal(cpuProfiler.collect.callCount, 1)
    assert.equal(heapProfiler.collect.callCount, 1)
    assert.deepStrictEqual(cpuData, expectedCpuData)
    assert.deepStrictEqual(heapData, expectedHeapData)
    assert.ok(logger.debug.calledWith('Collecting profiling data for cpu'))
    assert.ok(logger.debug.calledWith('Collecting profiling data for heap'))
  })
})
