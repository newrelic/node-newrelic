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
 * sample, the `span_id` and `trace_id` label values. Node only ever has one
 * span per sample, so each appears at most once.
 *
 * @param {Buffer} encoded gzipped, protobuf-encoded pprof profile
 * @returns {object} the per-sample span and trace ids
 */
function decodeSamples(encoded) {
  const profile = Profile.decode(zlib.gunzipSync(encoded))
  const str = (i) => profile.stringTable.strings[i]

  const samples = profile.sample.map((sample) => {
    const spanIds = []
    const traceIds = []
    for (const label of sample.label || []) {
      const key = str(label.key)
      if (key === 'span_id') {
        spanIds.push(str(label.str))
      } else if (key === 'trace_id') {
        traceIds.push(str(label.str))
      }
    }

    return { spanIds, traceIds }
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

    test('attaches span_id and trace_id labels for the active span to CPU samples', async () => {
      profiler.start()

      let expected
      await helper.runInTransaction(agent, 'test', async (transaction) => {
        const parent = agent.tracer.getSegment()
        agent.tracer.addSegment('burnCpu', null, parent, false, (segment) => {
          burnCpu(500)
          expected = { traceId: transaction.traceId, spanId: segment.getSpanId() }
        })
      })

      const { samples } = decodeSamples(await profiler.collect())
      const labelled = samples.filter((s) => s.traceIds.length > 0)

      assert.ok(samples.length > 0, 'should have collected samples')
      assert.ok(labelled.length > 0, 'at least some samples should carry span labels')

      for (const sample of labelled) {
        assert.equal(sample.traceIds[0], expected.traceId, 'trace_id should match the active transaction')
        assert.equal(sample.spanIds[0], expected.spanId, 'span_id should match the active segment')
      }
    })

    test('attaches at most one span_id and one trace_id label per sample', async () => {
      profiler.start()

      await helper.runInTransaction(agent, 'web', async () => {
        burnCpu(500)
      })

      const { samples } = decodeSamples(await profiler.collect())

      assert.ok(samples.length > 0, 'should have collected samples')
      for (const sample of samples) {
        assert.ok(sample.spanIds.length <= 1, 'a sample should never have more than one span_id label')
        assert.ok(sample.traceIds.length <= 1, 'a sample should never have more than one trace_id label')
      }
    })

    test('emits trace_id only when span events are disabled so the segment has no span id', async () => {
      // Disable before the transaction is built: `spansEnabled` is read at
      // segment construction, and a null span id yields trace_id without span_id.
      agent.config.span_events.enabled = false

      profiler.start()

      let expected
      await helper.runInTransaction(agent, 'test', async (transaction) => {
        const parent = agent.tracer.getSegment()
        agent.tracer.addSegment('burnCpu', null, parent, false, (segment) => {
          burnCpu(500)
          expected = { traceId: transaction.traceId, spanId: segment.getSpanId() }
        })
      })

      assert.equal(expected.spanId, null, 'sanity: getSpanId() should be null when span events are disabled')

      const { samples } = decodeSamples(await profiler.collect())
      const labelled = samples.filter((s) => s.traceIds.length > 0)
      assert.ok(labelled.length > 0, 'at least some samples should carry a trace_id label')

      for (const sample of labelled) {
        assert.equal(sample.traceIds[0], expected.traceId, 'trace_id should match the active transaction')
        assert.equal(sample.spanIds.length, 0, 'no span_id should be present when span events are disabled')
      }
    })

    test('produces no span labels when no transaction is active', async () => {
      profiler.start()
      burnCpu(300)

      const { samples } = decodeSamples(await profiler.collect())

      const labelled = samples.filter((s) => s.traceIds.length > 0 || s.spanIds.length > 0)
      assert.equal(labelled.length, 0, 'samples outside a transaction should not carry span labels')
    })

    test('attributes samples to the correct span id for sibling segments', async () => {
      profiler.start()

      let expected
      await helper.runInTransaction(agent, 'test', async (transaction) => {
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
      const labelled = samples.filter((s) => s.traceIds.length > 0)
      assert.ok(labelled.length > 0, 'at least some samples should carry span labels')

      const seen = new Set()
      for (const sample of labelled) {
        assert.equal(sample.traceIds[0], expected.traceId, 'all samples share the transaction trace_id')
        assert.ok(
          expected.created.has(sample.spanIds[0]),
          `span_id ${sample.spanIds[0]} should belong to a segment created in this transaction`
        )
        seen.add(sample.spanIds[0])
      }

      assert.ok(seen.has(expected.first), 'first sibling segment should own some samples')
      assert.ok(seen.has(expected.second), 'second sibling segment should own some samples')
    })

    test('attributes samples to a child segment and restores the parent after it completes', async () => {
      profiler.start()

      let expected
      await helper.runInTransaction(agent, 'test', async (transaction) => {
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
      const labelled = samples.filter((s) => s.traceIds.length > 0)
      assert.ok(labelled.length > 0, 'at least some samples should carry span labels')

      const seen = new Set()
      for (const sample of labelled) {
        assert.equal(sample.traceIds[0], expected.traceId, 'all samples share the transaction trace_id')
        assert.ok(
          expected.created.has(sample.spanIds[0]),
          `span_id ${sample.spanIds[0]} should belong to a segment created in this transaction`
        )
        seen.add(sample.spanIds[0])
      }

      assert.ok(seen.has(expected.child), 'child segment should own some samples')
      assert.ok(
        seen.has(expected.parent),
        'parent segment should own samples after the child completes (context restored)'
      )
    })

    test('attributes samples to the correct trace_id across separate transactions', async () => {
      profiler.start()

      const traceIds = new Set()
      for (const suffix of ['one', 'two']) {
        await helper.runInTransaction(agent, 'test', async (transaction) => {
          transaction.name = `TestTransaction/${suffix}`
          traceIds.add(transaction.traceId)
          burnCpu(400)
        })
      }

      const { samples } = decodeSamples(await profiler.collect())
      const labelled = samples.filter((s) => s.traceIds.length > 0)
      assert.ok(labelled.length > 0, 'at least some samples should carry a trace_id label')

      const seen = new Set()
      for (const sample of labelled) {
        const traceId = sample.traceIds[0]
        assert.ok(traceIds.has(traceId), `sample trace_id should reference a known transaction (${traceId})`)
        seen.add(traceId)
      }

      assert.equal(seen.size, 2, 'samples from both transactions should be present with distinct trace ids')
    })
  })
}
