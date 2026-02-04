/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const helper = require('#testlib/agent_helper.js')
const testCases = require('#testlib/cross_agent_tests/distributed_tracing/partial_granularity.json')
const { assertDroppedSpans, assertMetrics, assertSpanTree } = require('./core-tracing-assertions')

for (const testCase of testCases) {
  test(testCase.test_name, (t, end) => {
    const config = {
      distributed_tracing: {
        sampler: {
          full_granularity: {
            enabled: false
          },
          partial_granularity: {
            enabled: true,
            type: testCase.partial_granularity_type
          }
        }
      }
    }
    const agent = helper.instrumentMockedAgent(config)
    t.after(() => {
      helper.unloadAgent(agent)
    })

    const fixture = require(`#testlib/cross_agent_tests/distributed_tracing/${testCase.tracer_info}`)

    helper.runInTransaction(agent, (transaction) => {
      transaction.baseSegment = transaction.trace.root
      generateTxData({ agent, transaction, fixture })
      transaction.end()
      const spans = agent.spanAggregator.getEvents()
      assertSpanTree({ spans, expectedSpans: testCase.expected_spans })
      assertDroppedSpans({ spans, droppedSpans: testCase.unexpected_spans })
      assertMetrics({ agent, expectedMetrics: testCase.expected_metrics })
      end()
    })
  })
}

/**
 * Creates n segments based on test case
 * It either builds a specific tree of segments or a random set of segments with the same parent
 *
 * @param {object} params to function
 * @param {Agent} params.agent agent instance
 * @param {Transaction} params.transaction active transaction
 * @param {object} params.fixture DSL to define the segments
 */
function generateTxData({ agent, transaction, fixture }) {
  const rootTracer = fixture.root_tracer
  const rootSegment = createSegment({ agent, name: rootTracer.name, parent: transaction.trace.root, transaction, fixture: rootTracer })
  transaction.baseSegment = rootSegment
  if (rootTracer.children_formula) {
    createRandomSegments({ agent, transaction, fixture: rootTracer.children_formula, parent: rootSegment })
  } else {
    createChildSegments({ agent, transaction, fixture: rootTracer.children, parent: rootSegment })
  }
}

/**
 * Iterates over fixture and creates segments with appropriate parent
 *
 * @param {object} params to function
 * @param {Agent} params.agent agent instance
 * @param {Transaction} params.transaction active transaction
 * @param {object} params.fixture DSL to define the segments
 * @param {TraceSegment} params.parent parent segment
 */
function createChildSegments({ agent, transaction, fixture, parent }) {
  for (const child of fixture) {
    const segment = createSegment({ agent, name: child.name, parent, transaction, fixture: child })
    if (child.children) {
      createChildSegments({ agent, transaction, parent: segment, fixture: child.children })
    }
  }
}

/**
 * Creates a segment with the appropriate parent, and relevant agent and user attrs(custom attributes)
 *
 * @param {object} params to function
 * @param {Agent} params.agent agent instance
 * @param {string} params.name name of segment
 * @param {TraceSegment} params.parent parent segment
 * @param {Transaction} params.transaction active transaction
 * @param {object} params.fixture DSL to define the segments
 * @returns {TraceSegment} segment created
 */
function createSegment({ agent, name, parent, transaction, fixture }) {
  const segment = agent.tracer.createSegment({ name, parent, transaction })
  segment.timer.start = fixture.timestamp
  segment.setDurationInMillis(fixture.duration_millis, segment.timer.start)

  if (fixture.agent_attrs) {
    for (const [key, value] of Object.entries(fixture.agent_attrs)) {
      segment.addAttribute(key, value)
    }
  }

  if (fixture.user_attrs) {
    const spanContext = segment.getSpanContext()
    for (const [key, value] of Object.entries(fixture.user_attrs)) {
      spanContext.addCustomAttribute(key, value)
    }
  }
  return segment
}

/**
 * Creates a set of random segments with the same parent
 *
 * @param {object} params to function
 * @param {Agent} params.agent agent instance
 * @param {Transaction} params.transaction active transaction
 * @param {object} params.fixture DSL to define the segments
 * @param {TraceSegment} params.parent parent segment
 */
function createRandomSegments({ agent, transaction, fixture, parent }) {
  let segment = parent
  for (let i = 1; i <= fixture.num_children; i++) {
    fixture.timestamp = segment.timer.start + segment.timer.durationInMillis + fixture.duration_gap_millis
    const name = fixture.name_prefix + i
    segment = createSegment({ agent, name, parent, transaction, fixture })
  }
}
