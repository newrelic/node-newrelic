/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const otel = require('@opentelemetry/api')
const helper = require('#testlib/agent_helper.js')

const GEN_AI_ATTRS = [
  'gen_ai.input.messages',
  'gen_ai.output.messages',
  'gen_ai.system_instructions',
  'gen_ai.tool.definitions'
]

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    opentelemetry: {
      enabled: true,
      traces: { enabled: true }
    }
  })
  agent.config.entity_guid = 'guid-123456'
  agent.config.license_key = 'license-123456'

  const tracer = otel.trace.getTracer('gen-ai-test', '1.0.0')
  ctx.nr = { agent, tracer }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

function createLongValues() {
  // The default attribute byte limit is 256 bytes, so every value here is
  // deliberately much longer than that.
  return Object.fromEntries(GEN_AI_ATTRS.map((key) => [key, `${key}-`.repeat(50)]))
}

function endSpanAndGetEvent({ agent, tracer, attributes }) {
  let spanEvent
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'gen-ai-harvest-test'
    tracer.startActiveSpan('gen-ai-span', { attributes }, (span) => {
      span.end()
      tx.end()
      spanEvent = agent.spanEventAggregator.getEvents().find(
        (s) => s.intrinsics.name === 'gen-ai-span'
      )
    })
  })
  return spanEvent
}

test('attributes named in the server\'s `gen_ai.untruncated_attributes` connect response survive harvest untruncated, others do not', (t) => {
  const { agent, tracer } = t.nr
  const longValues = createLongValues()

  // Simulate the real-world sequence: the collector tells the agent, via the
  // connect response, which gen_ai attributes it should not truncate. Only a
  // subset is named here to confirm the reconciler honors exactly what the
  // server sent rather than exempting every gen_ai.* attribute outright.
  agent.config.onConnect({
    gen_ai: {
      untruncated_attributes: ['gen_ai.input.messages', 'gen_ai.tool.definitions']
    }
  })

  const spanEvent = endSpanAndGetEvent({ agent, tracer, attributes: longValues })
  assert.ok(spanEvent, 'span event should be harvested')

  assert.equal(spanEvent.attributes['gen_ai.input.messages'], longValues['gen_ai.input.messages'])
  assert.equal(spanEvent.attributes['gen_ai.tool.definitions'], longValues['gen_ai.tool.definitions'])

  assert.equal(spanEvent.attributes['gen_ai.output.messages'].length, agent.config.attributes.value_size_limit)
  assert.equal(spanEvent.attributes['gen_ai.system_instructions'].length, agent.config.attributes.value_size_limit)
})

test('gen_ai attributes are truncated like any other attribute before a connect response names them', (t) => {
  const { agent, tracer } = t.nr
  const longValues = createLongValues()

  // No onConnect call: the agent has not yet heard from the server, so none
  // of the gen_ai.* attributes should be exempt yet.
  const spanEvent = endSpanAndGetEvent({ agent, tracer, attributes: longValues })
  assert.ok(spanEvent, 'span event should be harvested')

  for (const key of GEN_AI_ATTRS) {
    assert.equal(spanEvent.attributes[key].length, agent.config.attributes.value_size_limit, `${key} should be truncated to the byte limit`)
  }
})
