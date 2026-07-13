/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { describe, test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const HeapProfiler = require('#agentlib/profiling/profilers/heap.js')
const pprof = require('@datadog/pprof')

beforeEach((ctx) => {
  const sandbox = sinon.createSandbox()
  const logger = require('../../../mocks/logger')(sandbox)

  sandbox.stub(pprof.heap, 'start')
  sandbox.stub(pprof.heap, 'stop')
  // `pprof.encode` is a non-configurable getter, so it can't be stubbed; instead
  // return a profile whose `encodeAsync` satisfies the real encode path.
  sandbox.stub(pprof.heap, 'profile').returns({
    encodeAsync: async () => Buffer.from('heap-profile')
  })

  ctx.nr = { sandbox, logger }
})

afterEach((ctx) => {
  ctx.nr.sandbox.restore()
})

describe('HeapProfiler source mapping', () => {
  test('passes the injected SourceMapper to heap.profile', async (t) => {
    const { logger } = t.nr
    const fakeMapper = { mappingInfo() {} }
    const profiler = new HeapProfiler({ logger, sourceMapper: fakeMapper })

    await profiler.collect()

    assert.equal(pprof.heap.profile.callCount, 1)
    assert.strictEqual(pprof.heap.profile.firstCall.args[1], fakeMapper, 'should hand the mapper to pprof')
  })

  test('collects without a mapper when none is injected', async (t) => {
    const { logger } = t.nr
    const profiler = new HeapProfiler({ logger })

    await profiler.collect()

    assert.equal(pprof.heap.profile.callCount, 1)
    assert.strictEqual(pprof.heap.profile.firstCall.args[1], undefined, 'should collect without a mapper')
  })
})
