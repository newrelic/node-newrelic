/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
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
  const agent = helper.loadMockedAgent()
  const cpuProfiler = {
    collect() {
      return 'cpu profile data'
    }
  }

  const clock = sinon.useFakeTimers()
  const heapProfiler = {
    collect() {
      return 'heap profile data'
    }
  }
  const profiler = {
    profilers: [cpuProfiler, heapProfiler]
  }
  sinon.spy(agent.collector, 'send')
  const profilingAggregator = new ProfilingAggregator({ runId: RUN_ID, periodMs: 100, profiler }, agent)
  ctx.nr = {
    agent,
    clock,
    profilingAggregator,
    profiler
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.clock.restore()
  ctx.nr.agent.collector.send.restore()
})

test('should set the correct default method', (t) => {
  const { profilingAggregator } = t.nr
  const method = profilingAggregator.method
  assert.equal(method, 'pprof_data')
})

test('should intialize pprofData and profiler', (t) => {
  const { profilingAggregator, profiler } = t.nr
  assert.deepEqual(profilingAggregator.profiler, profiler)
  assert.equal(profilingAggregator.pprofData, null)
})

test('should send 2 messages per interval', (t) => {
  const { profilingAggregator, clock, agent } = t.nr
  profilingAggregator.start()
  assert.equal(agent.collector.send.callCount, 0)
  clock.tick(100)
  assert.equal(agent.collector.send.callCount, 2)
  const [cpuCall, heapCall] = agent.collector.send.args
  assert.equal(cpuCall[0], 'pprof_data')
  assert.equal(cpuCall[1], 'cpu profile data')
  assert.equal(heapCall[0], 'pprof_data')
  assert.equal(heapCall[1], 'heap profile data')
  assert.equal(profilingAggregator.pprofData, null)
})
