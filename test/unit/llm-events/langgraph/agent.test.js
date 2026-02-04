/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmAgent = require('#agentlib/llm-events/langgraph/agent.js')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = {
    config: {
      ai_monitoring: {
        record_content: {
          enabled: true
        }
      }
    },
    tracer: {
      getTransaction() {
        return ctx.nr.transaction
      }
    }
  }

  ctx.nr.transaction = {
    traceId: 'trace-1',
    trace: {
      custom: {
        get() {
          return {
            'llm.foo': 'bar'
          }
        }
      }
    }
  }

  ctx.nr.segment = {
    id: 'segment-1'
  }

  ctx.nr.aiAgentName = 'test-agent'
})

test('constructs default instance', async (t) => {
  const event = new LlmAgent(t.nr)
  assert.equal(event.name, 'test-agent')
  assert.match(event.id, /[a-z0-9-]{32}/)
  assert.equal(event.span_id, 'segment-1')
  assert.equal(event.trace_id, 'trace-1')
  assert.equal(event['llm.foo'], 'bar')
  assert.equal(event.ingest_source, 'Node')
  assert.equal(event.vendor, 'langgraph')
})

test('constructs instance with error', async (t) => {
  t.nr.error = true
  const event = new LlmAgent(t.nr)
  assert.equal(event.error, true)
})

test('uses default name when not provided', async (t) => {
  delete t.nr.aiAgentName
  const event = new LlmAgent(t.nr)
  assert.equal(event.name, 'agent')
})
