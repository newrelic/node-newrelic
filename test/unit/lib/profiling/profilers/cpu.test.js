/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { describe, test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const CpuProfiler = require('#agentlib/profiling/profilers/cpu.js')
const pprof = require('@datadog/pprof')
const helper = require('#testlib/agent_helper.js')

beforeEach((ctx) => {
  const sandbox = sinon.createSandbox()
  const logger = require('../../../mocks/logger')(sandbox)
  const agent = helper.loadMockedAgent()

  // Track started state so `stop` tears down what `start` installed, keeping
  // tests isolated without running the native sampler.
  let started = false
  sandbox.stub(pprof.time, 'isStarted').callsFake(() => started)
  sandbox.stub(pprof.time, 'start').callsFake(() => {
    started = true
  })
  sandbox.stub(pprof.time, 'stop').callsFake(() => {
    started = false
  })
  sandbox.stub(pprof.time, 'getState').returns({})
  sandbox.stub(pprof.time, 'setContext')

  ctx.nr = { sandbox, logger, agent, tracer: agent.tracer, profiler: null }
})

afterEach((ctx) => {
  ctx.nr.profiler?.stop()
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.sandbox.restore()
})

describe('CpuProfiler source mapping', () => {
  test('passes the injected SourceMapper to time.start', (t) => {
    const { logger, tracer } = t.nr
    const fakeMapper = { mappingInfo() {} }
    const profiler = t.nr.profiler = new CpuProfiler({ logger, samplingInterval: 60_000, tracer, sourceMapper: fakeMapper })

    profiler.start()

    assert.equal(pprof.time.start.callCount, 1)
    assert.strictEqual(pprof.time.start.firstCall.args[0].sourceMapper, fakeMapper, 'should hand the mapper to pprof')
  })

  test('starts without a mapper when none is injected', (t) => {
    const { logger, tracer } = t.nr
    const profiler = t.nr.profiler = new CpuProfiler({ logger, samplingInterval: 60_000, tracer })

    profiler.start()

    assert.equal(pprof.time.start.callCount, 1)
    assert.strictEqual(pprof.time.start.firstCall.args[0].sourceMapper, undefined, 'should start without a mapper')
  })
})
