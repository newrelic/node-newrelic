/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LangChainTool = require('../../../../lib/llm-events/langchain/tool')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr._tx = {
    trace: {
      custom: {
        get() {
          return {
            'llm.conversation_id': 'test-conversation'
          }
        }
      }
    }
  }

  ctx.nr.agent = {
    config: {
      ai_monitoring: {
        record_content: {
          enabled: true
        }
      },
      applications() {
        return ['test-app']
      }
    },
    tracer: {
      getTransaction() {
        return ctx.nr._tx
      }
    }
  }

  ctx.nr.segment = {
    getDurationInMillis() {
      return 1.01
    },
    id: 'segment-1',
    transaction: {
      traceId: 'trace-1'
    }
  }

  ctx.nr.runId = 'run-1'
  ctx.nr.metadata = { foo: 'foo' }
  ctx.nr.name = 'test-tool'
  ctx.nr.description = 'test tool description'
  ctx.nr.input = 'input'
  ctx.nr.output = 'output'
})

test('constructs default instance', async (t) => {
  const event = new LangChainTool(t.nr)
  assert.equal(event.input, 'input')
  assert.equal(event.output, 'output')
  assert.equal(event.name, 'test-tool')
  assert.equal(event.description, 'test tool description')
  assert.equal(event.run_id, 'run-1')
  assert.match(event.id, /[a-z0-9-]{36}/)
  assert.equal(event.appName, 'test-app')
  assert.equal(event.span_id, 'segment-1')
  assert.equal(event.trace_id, 'trace-1')
  assert.equal(event.duration, 1.01)
  assert.equal(event['metadata.foo'], 'foo')
  assert.equal(event.ingest_source, 'Node')
  assert.equal(event.vendor, 'langchain')
})

test('respects record_content setting', async (t) => {
  t.nr.agent.config.ai_monitoring.record_content.enabled = false
  const event = new LangChainTool(t.nr)
  assert.equal(event.input, undefined)
  assert.equal(event.output, undefined)
})
