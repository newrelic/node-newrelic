/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LangChainCompletionSummary = require('../../../../lib/llm-events/langchain/chat-completion-summary')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.transaction = {
    traceId: 'trace-1',
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
      applications() {
        return ['test-app']
      }
    },
    tracer: {
      getTransaction() {
        return ctx.nr.transaction
      }
    }
  }

  ctx.nr.segment = {
    id: 'segment-1',
    getDurationInMillis() {
      return 42
    }
  }

  ctx.nr.runId = 'run-1'
  ctx.nr.metadata = { foo: 'foo' }
})

test('creates entity', async (t) => {
  const msg = new LangChainCompletionSummary(t.nr)
  assert.match(msg.id, /[a-z0-9-]{36}/)
  assert.equal(msg.appName, 'test-app')
  assert.equal(msg['llm.conversation_id'], 'test-conversation')
  assert.equal(msg.span_id, 'segment-1')
  assert.equal(msg.request_id, 'run-1')
  assert.equal(msg.trace_id, 'trace-1')
  assert.equal(msg['metadata.foo'], 'foo')
  assert.equal(msg.ingest_source, 'Node')
  assert.equal(msg.vendor, 'langchain')
  assert.equal(msg.virtual_llm, true)
  assert.equal(msg.tags, '')
  assert.equal(msg.duration, 42)
  assert.equal(msg['response.number_of_messages'], 0)
})
