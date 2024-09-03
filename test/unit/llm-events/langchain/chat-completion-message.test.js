/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LangChainCompletionMessage = require('../../../../lib/llm-events/langchain/chat-completion-message')

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
    id: 'segment-1',
    transaction: {
      traceId: 'trace-1'
    }
  }

  ctx.nr.runId = 'run-1'
  ctx.nr.metadata = { foo: 'foo' }
})

test('creates entity', async (ctx) => {
  const msg = new LangChainCompletionMessage({
    ...ctx.nr,
    sequence: 1,
    content: 'hello world'
  })
  assert.equal(msg.id, 'run-1-1')
  assert.equal(msg.appName, 'test-app')
  assert.equal(msg['llm.conversation_id'], 'test-conversation')
  assert.equal(msg.span_id, 'segment-1')
  assert.equal(msg.request_id, 'run-1')
  assert.equal(msg.trace_id, 'trace-1')
  assert.equal(msg['metadata.foo'], 'foo')
  assert.equal(msg.ingest_source, 'Node')
  assert.equal(msg.vendor, 'langchain')
  assert.equal(msg.virtual_llm, true)
  assert.equal(msg.sequence, 1)
  assert.equal(msg.content, 'hello world')
  assert.match(msg.completion_id, /[a-z0-9-]{36}/)
})

test('assigns id correctly', async (ctx) => {
  let msg = new LangChainCompletionMessage({ ...ctx.nr, runId: '', sequence: 1 })
  assert.match(msg.id, /[a-z0-9-]{36}-1/)

  msg = new LangChainCompletionMessage({ ...ctx.nr, runId: '123456', sequence: 42 })
  assert.equal(msg.id, '123456-42')
})

test('respects record_content setting', async (ctx) => {
  ctx.nr.agent.config.ai_monitoring.record_content.enabled = false
  const search = new LangChainCompletionMessage({
    ...ctx.nr,
    sequence: 1,
    content: 'hello world'
  })
  assert.equal(search.content, undefined)
})
