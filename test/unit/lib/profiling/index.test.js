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
const { PROFILING } = require('#agentlib/metrics/names.js')
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
  const profilingManager = new ProfilingManager({ agent, samplingInterval: 60_000 }, { logger })
  ctx.nr = {
    agent,
    cpuProfiler,
    heapProfiler,
    logger,
    profilingManager,
    sandbox
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.sandbox.restore()
})

describe('constructor', () => {
  test('should initialize with agent config', (t) => {
    const { profilingManager } = t.nr

    assert.ok(profilingManager.config, 'should have config')
    assert.deepStrictEqual(profilingManager.config, t.nr.agent.config.profiling, 'should store agent config')
  })

  test('should initialize empty profilers map', (t) => {
    const { profilingManager } = t.nr

    assert.strictEqual(profilingManager.profilers.size, 0, 'profilers map should be empty')
  })
})

describe('register', () => {
  test('should be a no-op by default', (t) => {
    const { profilingManager } = t.nr
    profilingManager.register()

    assert.strictEqual(profilingManager.profilers.size, 0, 'should not add any profilers')
  })

  test('should register the heap and cpu profilers only once', (t) => {
    const { profilingManager } = t.nr
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

  test('registers the cpu profiler with the cached source mapper', (t) => {
    const { profilingManager } = t.nr
    const mapper = { infoMap: new Map() }
    profilingManager.sourceMapper = mapper
    profilingManager.config.include = ['cpu']

    profilingManager.register()

    const cpuProfiler = profilingManager.profilers.get('CpuProfiler')
    assert.ok(cpuProfiler, 'should register the cpu profiler')
    assert.strictEqual(cpuProfiler.sourceMapper, mapper, 'should forward the cached mapper')
  })

  test('registers the heap profiler with the cached source mapper', (t) => {
    const { profilingManager } = t.nr
    const mapper = { infoMap: new Map() }
    profilingManager.sourceMapper = mapper
    profilingManager.config.include = ['heap']

    profilingManager.register()

    const heapProfiler = profilingManager.profilers.get('HeapProfiler')
    assert.ok(heapProfiler, 'should register the heap profiler')
    assert.strictEqual(heapProfiler.sourceMapper, mapper, 'should forward the cached mapper')
  })
})

describe('buildSourceMapper', () => {
  test('builds and caches the mapper from the app root when enabled', async (t) => {
    const { profilingManager, sandbox } = t.nr
    const { SourceMapper } = require('@datadog/pprof')
    const mapper = { infoMap: new Map() }
    const create = sandbox.stub(SourceMapper, 'create').resolves(mapper)
    profilingManager.config.source_mapping = { enabled: true }

    await profilingManager.buildSourceMapper()

    assert.strictEqual(profilingManager.sourceMapper, mapper, 'should cache the built mapper')
    assert.equal(create.callCount, 1, 'should build the mapper once')
    assert.deepStrictEqual(create.firstCall.args[0], [process.cwd()], 'should scan the application root')
  })

  test('is a no-op when source mapping is disabled', async (t) => {
    const { profilingManager, sandbox } = t.nr
    const { SourceMapper } = require('@datadog/pprof')
    const create = sandbox.stub(SourceMapper, 'create')
    profilingManager.config.source_mapping = { enabled: false }

    await profilingManager.buildSourceMapper()

    assert.strictEqual(profilingManager.sourceMapper, null, 'should leave the mapper null')
    assert.equal(create.callCount, 0, 'should not scan for source maps')
  })

  test('leaves the mapper null and logs when the build fails', async (t) => {
    const { profilingManager, logger, sandbox } = t.nr
    const { SourceMapper } = require('@datadog/pprof')
    sandbox.stub(SourceMapper, 'create').rejects(new Error('scan failed'))
    profilingManager.config.source_mapping = { enabled: true }

    await profilingManager.buildSourceMapper()

    assert.strictEqual(profilingManager.sourceMapper, null, 'should fall back to compiled file/line')
    assert.equal(logger.error.callCount, 1, 'should log the build failure')
  })
})

describe('start', () => {
  test('should warn when no profilers are registered', (t) => {
    const { profilingManager, logger } = t.nr

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
    const { cpuProfiler, heapProfiler, profilingManager, logger } = t.nr
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
    const { logger, profilingManager } = t.nr
    profilingManager.stop()

    assert.equal(logger.warn.callCount, 1)
    assert.ok(
      logger.warn.calledWith(
        'No profilers have been included in `config.profiling.include`, not stopping any profilers.'
      )
    )
  })

  test('should stop all registered profilers', (t) => {
    const { cpuProfiler, heapProfiler, logger, profilingManager } = t.nr
    profilingManager.profilers.set('cpu', cpuProfiler)
    profilingManager.profilers.set('heap', heapProfiler)
    profilingManager.stop()

    assert.equal(cpuProfiler.stop.callCount, 1)
    assert.equal(heapProfiler.stop.callCount, 1)
    assert.ok(logger.debug.calledWith('Stopping cpu'))
    assert.ok(logger.debug.calledWith('Stopping heap'))
  })

  test('should log supportability metric for profiling duration', (t) => {
    const { agent, profilingManager, cpuProfiler, heapProfiler, sandbox } = t.nr
    profilingManager.profilers.set('cpu', cpuProfiler)
    profilingManager.profilers.set('heap', heapProfiler)

    const startTime = 1000
    const stopTime = 3000
    profilingManager.startTime = startTime
    sandbox.stub(Date, 'now').returns(stopTime)

    profilingManager.stop()

    const metrics = agent.metrics._metrics.unscoped
    assert.ok(metrics[`${PROFILING.PREFIX}${PROFILING.DURATION}`], 'should have profiling duration supportability metric')
    assert.equal(metrics[`${PROFILING.PREFIX}${PROFILING.DURATION}`].total, (stopTime - startTime) / 1000)
  })
})

describe('collect', (t) => {
  test('should warn and return empty array when no profilers are registered', async (t) => {
    const { profilingManager, logger } = t.nr

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
    const { profilingManager, cpuProfiler, heapProfiler, logger } = t.nr

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
    const { profilingManager, cpuProfiler, heapProfiler, logger } = t.nr

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
