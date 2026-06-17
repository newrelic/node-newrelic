/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test, describe, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const zlib = require('node:zlib')
const { AsyncLocalStorage } = require('node:async_hooks')

const helper = require('../../lib/agent_helper')
const CpuProfiler = require('../../../lib/profiling/profilers/cpu')
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
 * into an `extracted` object.
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
        const extracted = Object.fromEntries(str(label.str).split(',').map((pair) => pair.split('=')))
        spanLabels.push({ key, extracted })
      }
    }

    return { spanLabels }
  })

  return { samples }
}

// AsyncContextFrame is active when `AsyncLocalStorage.run` delegates to
// `enterWith` — the same check CpuProfiler uses. CPED is only exercisable then.
const asyncContextFrameActive = (() => {
  let active = false
  const als = new AsyncLocalStorage()
  als.enterWith = () => {
    active = true
  }
  als.run(1, () => {})
  als.disable()
  return active
})()

// The holder path runs on any runtime; CPED only when AsyncContextFrame is active.
const variants = [{ label: 'non-CPED (holder + run hook)', useCPED: false }]
if (asyncContextFrameActive) {
  variants.push({ label: 'CPED (per async-context-frame)', useCPED: true })
}

for (const variant of variants) {
  describe(`CpuProfiler span labels — ${variant.label}`, () => {
    let agent
    let profiler

    beforeEach(() => {
      agent = helper.instrumentMockedAgent({
        distributed_tracing: { enabled: true },
        profiling: { enabled: true, include: ['cpu'] }
      })
      profiler = new CpuProfiler({
        logger,
        samplingInterval: 60_000,
        tracer: agent.tracer,
        useCPED: variant.useCPED
      })
    })

    afterEach(() => {
      profiler?.stop()
      helper.unloadAgent(agent)
    })

    test('attaches a span: label with the active span_id and trace_id to CPU samples', async () => {
      profiler.start()

      const name = 'TestTransaction/profiling'
      let expected
      await helper.runInTransaction(agent, 'test', async (transaction) => {
        // Set a finalized transaction name so the span key includes it.
        transaction.name = name
        const parent = agent.tracer.getSegment()
        agent.tracer.addSegment('burnCpu', null, parent, false, (segment) => {
          burnCpu(500)
          expected = { traceId: transaction.traceId, spanId: segment.getSpanId() }
        })
      })

      const { samples } = decodeSamples(await profiler.collect())
      const labelled = samples.filter((s) => s.spanLabels.length > 0)

      assert.ok(samples.length > 0, 'should have collected samples')
      assert.ok(labelled.length > 0, 'at least some samples should carry a span: label')

      const expectedKey = `span:${expected.traceId.slice(0, 16)}:${name}`
      for (const sample of labelled) {
        const [{ key, extracted }] = sample.spanLabels
        assert.equal(key, expectedKey, 'label key should be span:<traceId[0:16]>:<name>')
        assert.equal(extracted.trace_id, expected.traceId, 'trace_id should match the active transaction')
        assert.equal(extracted.span_id, expected.spanId, 'span_id should match the active segment')
      }
    })

    test('attaches at most one `span:` label per sample', async () => {
      profiler.start()

      await helper.runInTransaction(agent, 'web', async () => {
        burnCpu(500)
      })

      const { samples } = decodeSamples(await profiler.collect())

      assert.ok(samples.length > 0, 'should have collected samples')
      for (const sample of samples) {
        assert.ok(sample.spanLabels.length <= 1, 'a sample should never have more than one `span:` label')
      }
    })

    test('emits trace_id only when span events are disabled so the segment has no span id', async () => {
      // Disable before the transaction is built: `spansEnabled` is read at
      // segment construction, and a null span id yields trace_id without span_id.
      agent.config.span_events.enabled = false

      profiler.start()

      const name = 'TestTransaction/profiling'
      let expected
      await helper.runInTransaction(agent, 'test', async (transaction) => {
        transaction.name = name
        const parent = agent.tracer.getSegment()
        agent.tracer.addSegment('burnCpu', null, parent, false, (segment) => {
          burnCpu(500)
          expected = { traceId: transaction.traceId, spanId: segment.getSpanId() }
        })
      })

      assert.equal(expected.spanId, null, 'sanity: getSpanId() should be null when span events are disabled')

      const { samples } = decodeSamples(await profiler.collect())
      const labelled = samples.filter((s) => s.spanLabels.length > 0)
      assert.ok(labelled.length > 0, 'at least some samples should carry a span: label')

      const expectedKey = `span:${expected.traceId.slice(0, 16)}:${name}`
      for (const sample of labelled) {
        const [{ key, extracted }] = sample.spanLabels
        assert.equal(key, expectedKey, 'label key should be span:<traceId[0:16]>:<name>')
        assert.equal(extracted.trace_id, expected.traceId, 'trace_id should match the active transaction')
        assert.equal(extracted.span_id, undefined, 'no span_id should be present when span events are disabled')
      }
    })

    test('produces no `span:` labels when no transaction is active', async () => {
      profiler.start()
      burnCpu(300)

      const { samples } = decodeSamples(await profiler.collect())

      const labelled = samples.filter((s) => s.spanLabels.length > 0)
      assert.equal(labelled.length, 0, 'samples outside a transaction should not carry `span:` labels')
    })

    test('attributes samples to the correct span id for sibling segments', async () => {
      profiler.start()

      const name = 'TestTransaction/siblings'
      let expected
      await helper.runInTransaction(agent, 'test', async (transaction) => {
        transaction.name = name
        const root = agent.tracer.getSegment()

        let first
        let second
        agent.tracer.addSegment('first', null, root, false, (segment) => {
          first = segment.getSpanId()
          burnCpu(400)
        })
        agent.tracer.addSegment('second', null, root, false, (segment) => {
          second = segment.getSpanId()
          burnCpu(400)
        })

        expected = {
          traceId: transaction.traceId,
          created: new Set([root.getSpanId(), first, second]),
          first,
          second
        }
      })

      const { samples } = decodeSamples(await profiler.collect())
      const labelled = samples.filter((s) => s.spanLabels.length > 0)
      assert.ok(labelled.length > 0, 'at least some samples should carry a span: label')

      const expectedKey = `span:${expected.traceId.slice(0, 16)}:${name}`
      const seen = new Set()
      for (const sample of labelled) {
        const [{ key, extracted }] = sample.spanLabels
        assert.equal(key, expectedKey, 'label key should be span:<traceId[0:16]>:<name>')
        assert.equal(extracted.trace_id, expected.traceId, 'all samples share the transaction trace_id')
        assert.ok(
          expected.created.has(extracted.span_id),
          `span_id ${extracted.span_id} should belong to a segment created in this transaction`
        )
        seen.add(extracted.span_id)
      }

      assert.ok(seen.has(expected.first), 'first sibling segment should own some samples')
      assert.ok(seen.has(expected.second), 'second sibling segment should own some samples')
    })

    test('attributes samples to a child segment and restores the parent after it completes', async () => {
      profiler.start()

      const name = 'TestTransaction/nested'
      let expected
      await helper.runInTransaction(agent, 'test', async (transaction) => {
        transaction.name = name
        const root = agent.tracer.getSegment()

        let parentId
        let childId
        agent.tracer.addSegment('parent', null, root, false, (parentSegment) => {
          parentId = parentSegment.getSpanId()

          // Nest a child segment and do all of its CPU work inside it.
          agent.tracer.addSegment('child', null, parentSegment, false, (childSegment) => {
            childId = childSegment.getSpanId()
            burnCpu(400)
          })

          // The child segment has ended, so the active context is restored to
          // `parent`. CPU burned here can only be attributed to `parent`; seeing
          // the parent span id below proves the child's span id did not leak past
          // its scope.
          burnCpu(400)
        })

        expected = {
          traceId: transaction.traceId,
          created: new Set([root.getSpanId(), parentId, childId]),
          parent: parentId,
          child: childId
        }
      })

      const { samples } = decodeSamples(await profiler.collect())
      const labelled = samples.filter((s) => s.spanLabels.length > 0)
      assert.ok(labelled.length > 0, 'at least some samples should carry a span: label')

      const expectedKey = `span:${expected.traceId.slice(0, 16)}:${name}`
      const seen = new Set()
      for (const sample of labelled) {
        const [{ key, extracted }] = sample.spanLabels
        assert.equal(key, expectedKey, 'label key should be span:<traceId[0:16]>:<name>')
        assert.equal(extracted.trace_id, expected.traceId, 'all samples share the transaction trace_id')
        assert.ok(
          expected.created.has(extracted.span_id),
          `span_id ${extracted.span_id} should belong to a segment created in this transaction`
        )
        seen.add(extracted.span_id)
      }

      assert.ok(seen.has(expected.child), 'child segment should own some samples')
      assert.ok(
        seen.has(expected.parent),
        'parent segment should own samples after the child completes (context restored)'
      )
    })

    test('attributes samples to the correct trace_id across separate transactions', async () => {
      profiler.start()

      // Map each trace-id slice (the label key's id portion) to its full trace
      // id so we can cross-check the key against the sampled trace_id.
      const traceBySlice = new Map()

      for (const suffix of ['one', 'two']) {
        await helper.runInTransaction(agent, 'test', async (transaction) => {
          transaction.name = `TestTransaction/${suffix}`
          traceBySlice.set(transaction.traceId.slice(0, 16), transaction.traceId)
          burnCpu(400)
        })
      }

      const { samples } = decodeSamples(await profiler.collect())
      const labelled = samples.filter((s) => s.spanLabels.length > 0)
      assert.ok(labelled.length > 0, 'at least some samples should carry a span: label')

      const seenSlices = new Set()
      for (const sample of labelled) {
        const [{ key, extracted }] = sample.spanLabels
        const idPart = key.split(':')[1]
        assert.ok(traceBySlice.has(idPart), `sample key should reference a known transaction (${idPart})`)
        assert.equal(
          extracted.trace_id,
          traceBySlice.get(idPart),
          'trace_id must match the transaction referenced by the label key'
        )
        seenSlices.add(idPart)
      }

      assert.equal(seenSlices.size, 2, 'samples from both transactions should be present with distinct trace ids')
    })
  })
}
