/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const ProfilingAggregator = require('#agentlib/aggregators/profiling-aggregator.js')
const helper = require('#testlib/agent_helper.js')
const RUN_ID = 1337

test.beforeEach((ctx) => {
  const sandbox = sinon.createSandbox()
  // setting the `profiling.include` to empty array
  // as we are creating mock profilers
  const agent = helper.loadMockedAgent({
    profiling: {
      include: []
    }
  })
  const cpuProfiler = {
    name: 'CpuProfiler',
    start: sandbox.stub(),
    stop: sandbox.stub(),
    async collect() {
      return 'cpu profile data'
    }
  }

  const clock = sinon.useFakeTimers()
  const heapProfiler = {
    name: 'HeapProfiler',
    start: sandbox.stub(),
    stop: sandbox.stub(),
    async collect() {
      return 'heap profile data'
    }
  }
  sandbox.spy(agent.collector, 'send')
  const profilingAggregator = new ProfilingAggregator({ runId: RUN_ID, periodMs: 100 }, agent)
  const profilingManager = profilingAggregator.profilingManager
  sandbox.spy(profilingManager, 'register')
  ctx.nr = {
    agent,
    clock,
    cpuProfiler,
    heapProfiler,
    profilingAggregator,
    profilingManager,
    sandbox
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.clock.restore()
  ctx.nr.sandbox.restore()
})

test('should set the correct default method', (t) => {
  const { profilingAggregator } = t.nr
  const method = profilingAggregator.method
  assert.equal(method, 'pprof_data')
})

test('should initialize pprofData and profilingManager', (t) => {
  const { profilingAggregator, profilingManager } = t.nr
  assert.deepEqual(profilingAggregator.profilingManager, profilingManager)
  assert.equal(profilingAggregator.pprofData, null)
})

test('should send 2 messages per interval', async (t) => {
  const { profilingAggregator, clock, agent, cpuProfiler, heapProfiler } = t.nr
  assert.equal(profilingAggregator.profilingManager.register.callCount, 0)
  profilingAggregator.profilingManager.profilers = [cpuProfiler, heapProfiler]
  profilingAggregator.start()
  assert.equal(profilingAggregator.profilingManager.register.callCount, 1)
  assert.equal(agent.collector.send.callCount, 0)
  clock.tick(100)
  // need to run in next tick to ensure the promise chain around `profilingManager.collectData` resolves
  await new Promise((resolve) => {
    process.nextTick(() => {
      assert.equal(agent.collector.send.callCount, 2)
      const [cpuCall, heapCall] = agent.collector.send.args
      assert.equal(cpuCall[0], 'pprof_data')
      assert.equal(cpuCall[1], 'cpu profile data')
      assert.equal(heapCall[0], 'pprof_data')
      assert.equal(heapCall[1], 'heap profile data')
      assert.equal(profilingAggregator.pprofData, null)
      resolve()
    })
  })
})

test('should not send any data if there are no profilers registered', async (t) => {
  const { profilingAggregator, clock, agent } = t.nr
  profilingAggregator.profilingManager.profilers = []
  profilingAggregator.start()
  assert.equal(agent.collector.send.callCount, 0)
  clock.tick(100)
  await new Promise((resolve) => {
    process.nextTick(() => {
      assert.equal(agent.collector.send.callCount, 0)
      resolve()
    })
  })
})

test('should stop ProfilingManager when aggregator is stopped', (t) => {
  const { profilingAggregator, cpuProfiler, heapProfiler } = t.nr
  profilingAggregator.profilingManager.profilers = [cpuProfiler, heapProfiler]
  profilingAggregator.start()
  assert.ok(profilingAggregator.sendTimer)
  for (const profiler of profilingAggregator.profilingManager.profilers) {
    assert.equal(profiler.stop.callCount, 0)
  }
  profilingAggregator.stop()
  assert.equal(profilingAggregator.sendTimer, null)
  for (const profiler of profilingAggregator.profilingManager.profilers) {
    assert.equal(profiler.stop.callCount, 1)
  }
})
