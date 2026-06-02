/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const zlib = require('node:zlib')

const helper = require('../../lib/agent_helper')
const CpuProfiler = require('../../../lib/profiling/profilers/cpu')
const Context = require('../../../lib/context-manager/context')
const { Profile } = require('pprof-format')

const logger = { trace() {}, debug() {}, error() {} }

/**
 * Burns CPU synchronously for at least `ms` milliseconds so the time profiler
 * has a chance to take samples while a context is active.
 *
 * @param {number} ms minimum time to burn
 * @returns {number} an accumulated value, to keep the loop from being optimized away
 */
function burnCpu(ms) {
  const end = Date.now() + ms
  let x = 0
  while (Date.now() < end) {
    for (let i = 0; i < 1e5; i++) {
      x += Math.sqrt(i)
    }
  }
  return x
}

/**
 * Decodes the gzipped pprof buffer returned by the profiler and collects, per
 * sample, the `span:`-prefixed labels. The label value is a comma-separated
 * list of `key=value` pairs (e.g. `span_id=...,trace_id=...`) which is parsed
 * into a `fields` object.
 *
 * @param {Buffer} encoded gzipped, protobuf-encoded pprof profile
 * @returns {object} the per-sample span labels
 */
function decodeSamples(encoded) {
  const profile = Profile.decode(zlib.gunzipSync(encoded))
  const str = (i) => profile.stringTable.strings[i]

  const samples = profile.sample.map((sample) => {
    const spanLabels = []
    for (const label of sample.label || []) {
      const key = str(label.key)
      if (key.startsWith('span:')) {
        // Extract trace_id and span_id into a separate object for easier assertions
        const extracted = Object.fromEntries(str(label.str).split(',').map((pair) => pair.split('=')))
        spanLabels.push({ key, extracted })
      }
    }

    return { spanLabels }
  })

  return { samples }
}

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    distributed_tracing: { enabled: true },
    profiling: { enabled: true, include: ['cpu'] }
  })
  const profiler = new CpuProfiler({ logger, samplingInterval: 60_000, tracer: agent.tracer })
  ctx.nr = { agent, profiler }
})

test.afterEach((ctx) => {
  if (ctx.nr.profiler) {
    ctx.nr.profiler.stop()
  }
  helper.unloadAgent(ctx.nr.agent)
})

test('attaches a span: label with the active span_id and trace_id to CPU samples', async (t) => {
  const { agent, profiler } = t.nr

  profiler.start()

  const name = 'TestTransaction/profiling'
  let expected
  await helper.runInTransaction(agent, 'test', async (transaction) => {
    // Set a finalized transaction name so the span key includes it.
    transaction.name = name
    const parent = agent.tracer.getSegment()
    agent.tracer.addSegment('burnCpu', null, parent, false, (segment) => {
      burnCpu(500)
      expected = { id: transaction.id, traceId: transaction.traceId, spanId: segment.getSpanId() }
    })
  })

  const encoded = await profiler.collect()
  const { samples } = decodeSamples(encoded)

  const labelled = samples.filter((s) => s.spanLabels.length > 0)

  assert.ok(samples.length > 0, 'should have collected samples')
  assert.ok(labelled.length > 0, 'at least some samples should carry a span: label')

  // Assert that `span:` key and value contains correct trace_id and span_id
  const expectedKey = `span:${expected.id}:${name}`
  for (const sample of labelled) {
    const [{ key, extracted }] = sample.spanLabels
    assert.equal(key, expectedKey, 'label key should be span:<transaction.id>:<name>')
    assert.equal(extracted.trace_id, expected.traceId, 'trace_id should match the active transaction')
    assert.equal(extracted.span_id, expected.spanId, 'span_id should match the active segment')
  }
})

test('attaches at most one `span:` label per sample', async (t) => {
  const { agent, profiler } = t.nr

  profiler.start()

  await helper.runInTransaction(agent, 'web', async () => {
    burnCpu(500)
  })

  const encoded = await profiler.collect()
  const { samples } = decodeSamples(encoded)

  assert.ok(samples.length > 0, 'should have collected samples')
  for (const sample of samples) {
    assert.ok(sample.spanLabels.length <= 1, 'a sample should never have more than one `span:` label')
  }
})

test('emits trace_id only when a transaction is active but there is no segment', async (t) => {
  const { agent, profiler } = t.nr

  profiler.start()

  const name = 'TestTransaction/profiling'
  let expected
  await helper.runInTransaction(agent, 'test', async (transaction) => {
    transaction.name = name
    expected = { id: transaction.id, traceId: transaction.traceId }
    // Run with a context that carries the transaction but no active segment, so
    // `getSpanId()` is never reached and the label omits `span_id`.
    const context = new Context({ transaction, segment: null })
    agent.tracer.runInContext({ handler: () => burnCpu(500), context })
  })

  const encoded = await profiler.collect()
  const { samples } = decodeSamples(encoded)

  const labelled = samples.filter((s) => s.spanLabels.length > 0)
  assert.ok(labelled.length > 0, 'at least some samples should carry a span: label')

  const expectedKey = `span:${expected.id}:${name}`
  for (const sample of labelled) {
    const [{ key, extracted }] = sample.spanLabels
    assert.equal(key, expectedKey, 'label key should be span:<transaction.id>:<name>')
    assert.equal(extracted.trace_id, expected.traceId, 'trace_id should match the active transaction')
    assert.equal(extracted.span_id, undefined, 'no span_id should be present without an active segment')
  }
})

test('produces no `span:` labels when no transaction is active', async (t) => {
  const { profiler } = t.nr

  profiler.start()
  // Burn CPU with no active transaction context.
  burnCpu(300)

  const encoded = await profiler.collect()
  const { samples } = decodeSamples(encoded)

  const labelled = samples.filter((s) => s.spanLabels.length > 0)
  assert.equal(labelled.length, 0, 'samples outside a transaction should not carry `span:` labels')
})
