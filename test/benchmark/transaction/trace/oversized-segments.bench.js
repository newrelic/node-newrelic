/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('#testlib/agent_helper.js')
const benchmark = require('#testlib/benchmark.js')
const Transaction = require('#agentlib/transaction/index.js')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')

const MAX_TRACE_SEGMENTS = 900
const agent = helper.loadMockedAgent({ max_trace_segments: MAX_TRACE_SEGMENTS })
const suite = benchmark.createBenchmark({
  name: 'trace segments beyond max_trace_segments',
  runs: 100
})

let tx

/**
 * Mimics a transaction whose instrumentation created more segments than
 * `max_trace_segments` allows to be collected, e.g. a loop that awaits many
 * sequential datastore calls under one parent segment. Every segment, collected
 * or not, is given a real metrics recorder, matching what `tracer.createSegment`
 * does for every segment in production.
 *
 * @param {number} totalSegments number of child segments to create under root
 */
function buildOversizedTransaction(totalSegments) {
  tx = new Transaction(agent)
  const start = Date.now()

  for (let i = 0; i < totalSegments; ++i) {
    const segment = agent.tracer.createSegment({
      name: `Datastore/statement/Test/select/${i}`,
      recorder: genericRecorder,
      parent: tx.trace.root,
      transaction: tx
    })
    segment.timer.setDurationInMillis(1, start + i)
  }
}

suite.add({
  name: `record() with ${MAX_TRACE_SEGMENTS} segments (at the limit)`,
  before: () => buildOversizedTransaction(MAX_TRACE_SEGMENTS),
  fn: function () {
    return tx.record()
  }
})

suite.add({
  name: `record() with ${MAX_TRACE_SEGMENTS * 2} segments (2x over limit)`,
  before: () => buildOversizedTransaction(MAX_TRACE_SEGMENTS * 2),
  fn: function () {
    return tx.record()
  }
})

suite.add({
  name: `record() with ${MAX_TRACE_SEGMENTS * 10} segments (10x over limit)`,
  before: () => buildOversizedTransaction(MAX_TRACE_SEGMENTS * 10),
  fn: function () {
    return tx.record()
  }
})

suite.run()
