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

  test('includes schemaUrl in the instrumentation scope when provided', (t) => {
    const { processor, provider } = t.nr
    const tracer = provider.getTracer('my-lib', '2.0', { schemaUrl: 'https://example.com/schema' })
    tracer.startSpan('op')
    const [span] = processor.calls.onStart
    assert.deepEqual(span.instrumentationScope, { name: 'my-lib', version: '2.0', schemaUrl: 'https://example.com/schema' })
  })

  test('returns the same tracer for the same name and version', (t) => {
    const { provider } = t.nr
    const tracer1 = provider.getTracer('my-lib', '2.0')
    const tracer2 = provider.getTracer('my-lib', '2.0')
    assert.strictEqual(tracer1, tracer2)
  })

  test('returns different tracers for different names or versions', (t) => {
    const { provider } = t.nr
    const tracer1 = provider.getTracer('my-lib', '1.0')
    const tracer2 = provider.getTracer('my-lib', '2.0')
    const tracer3 = provider.getTracer('other-lib', '1.0')
    assert.notStrictEqual(tracer1, tracer2)
    assert.notStrictEqual(tracer1, tracer3)
  })

  test('returns different tracers for different schemaUrls', (t) => {
    const { provider } = t.nr
    const tracer1 = provider.getTracer('my-lib', '1.0', { schemaUrl: 'a' })
    const tracer2 = provider.getTracer('my-lib', '1.0', { schemaUrl: 'b' })
    assert.notStrictEqual(tracer1, tracer2)
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
