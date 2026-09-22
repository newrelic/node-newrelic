/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert')
const NrTracerProvider = require('#agentlib/otel/traces/nr-tracer-provider.js')
const NrTracer = require('#agentlib/otel/traces/nr-tracer.js')
const { makeProcessor, makeSampler } = require('./helpers')

test.beforeEach((ctx) => {
  const processor = makeProcessor()
  const sampler = makeSampler()
  const provider = new NrTracerProvider({ sampler, processor })
  ctx.nr = { provider, processor }
})

describe('getTracer', () => {
  test('returns an NrTracer', (t) => {
    const { provider } = t.nr
    const tracer = provider.getTracer('test-lib', '1.0')
    assert.ok(tracer instanceof NrTracer)
  })

  test('passes instrumentation scope to the tracer', (t) => {
    const { processor, provider } = t.nr
    const scope = { name: 'my-lib', version: '2.0' }
    const tracer = provider.getTracer(scope.name, scope.version)
    tracer.startSpan('op')
    const [span] = processor.calls.onStart
    assert.deepEqual(span.instrumentationScope, scope)
  })
})

test('forceFlush resolves', async (t) => {
  const { provider } = t.nr
  await assert.doesNotReject(() => provider.forceFlush())
})

test('shutdown resolves', async (t) => {
  const { provider } = t.nr
  await assert.doesNotReject(() => provider.shutdown())
})
