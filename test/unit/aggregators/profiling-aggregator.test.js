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
const WAIT = 180

test.beforeEach((ctx) => {
  const sandbox = sinon.createSandbox()
  const agent = helper.loadMockedAgent({
    profiling: {
      enabled: true,
      include: ['heap', 'cpu']
    }
  })
  sandbox.spy(agent.collector, 'send')
  const profilingAggregator = new ProfilingAggregator({ runId: RUN_ID, periodMs: 100 }, agent)
  const profilingManager = profilingAggregator.profilingManager
  sandbox.spy(profilingManager, 'register')
  ctx.nr = {
    agent,
    profilingAggregator,
    profilingManager,
    sandbox
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
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
  const { profilingAggregator, agent } = t.nr
  assert.equal(profilingAggregator.profilingManager.register.callCount, 0)
  profilingAggregator.start()
  assert.equal(profilingAggregator.profilingManager.register.callCount, 1)
  assert.equal(agent.collector.send.callCount, 0)
  await new Promise((resolve) => {
    setTimeout(() => {
      assert.equal(agent.collector.send.callCount, 2)
      const [cpuCall, heapCall] = agent.collector.send.args
      assert.equal(cpuCall[0], 'pprof_data')
      assert.equal(Buffer.isBuffer(cpuCall[1]), true)
      assert.equal(heapCall[0], 'pprof_data')
      assert.equal(Buffer.isBuffer(heapCall[1]), true)
      assert.equal(profilingAggregator.pprofData, null)
      resolve()
    }, WAIT)
  })
})

test('should not send any data if there are no profilers registered', async (t) => {
  const { profilingAggregator, agent } = t.nr
  profilingAggregator.profilingManager.config.include = []
  profilingAggregator.start()
  assert.equal(agent.collector.send.callCount, 0)
  await new Promise((resolve) => {
    setTimeout(() => {
      assert.equal(agent.collector.send.callCount, 0)
      resolve()
    }, WAIT)
  })
})

test('should not crash if profilers are started more than once', (t) => {
  const { profilingAggregator } = t.nr
  profilingAggregator.start()
  assert.doesNotThrow(() => {
    profilingAggregator.start()
  })
})

test('should stop ProfilingManager when aggregator is stopped', (t) => {
  const { profilingAggregator, sandbox } = t.nr
  profilingAggregator.start()
  assert.ok(profilingAggregator.sendTimer)
  sandbox.spy(profilingAggregator.profilingManager.profilers.get('HeapProfiler'), 'stop')
  sandbox.spy(profilingAggregator.profilingManager.profilers.get('CpuProfiler'), 'stop')
  for (const [, profiler] of profilingAggregator.profilingManager.profilers) {
    assert.equal(profiler.stop.callCount, 0)
  }
  profilingAggregator.stop()
  assert.equal(profilingAggregator.sendTimer, null)
  for (const [, profiler] of profilingAggregator.profilingManager.profilers) {
    assert.equal(profiler.stop.callCount, 1)
  }
})

test('should not crash if profilers are stopped more than once', (t) => {
  const { profilingAggregator } = t.nr
  profilingAggregator.start()
  profilingAggregator.stop()
  assert.doesNotThrow(() => {
    profilingAggregator.stop()
  })
})
