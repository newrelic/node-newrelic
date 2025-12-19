/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LangGraphAgentEvent = require('../../../../lib/llm-events/langgraph/agent')

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
    getDurationInMillis() {
      return 1.01
    },
    id: 'segment-1'
  }

  ctx.nr.name = 'test-agent'
})

test('constructs default instance', async (t) => {
  const event = new LangGraphAgentEvent(t.nr)
  assert.equal(event.name, 'test-agent')
  assert.match(event.id, /[a-z0-9-]{36}/)
  assert.equal(event.span_id, 'segment-1')
  assert.equal(event.trace_id, 'trace-1')
  assert.equal(event.duration, 1.01)
  assert.equal(event['llm.foo'], 'bar')
  assert.equal(event.ingest_source, 'Node')
  assert.equal(event.vendor, 'langgraph')
  assert.equal(event.error, false)
})

test('constructs instance with error', async (t) => {
  t.nr.error = true
  const event = new LangGraphAgentEvent(t.nr)
  assert.equal(event.error, true)
})

test('uses default name when not provided', async (t) => {
  delete t.nr.name
  const event = new LangGraphAgentEvent(t.nr)
  assert.equal(event.name, 'agent')
})
