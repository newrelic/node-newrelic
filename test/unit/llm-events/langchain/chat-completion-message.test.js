/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { LlmChatCompletionMessage } = require('#agentlib/llm-events/langchain/index.js')

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
        return ctx.nr.transaction
      }
    }
  }

  ctx.nr.segment = {
    id: 'segment-1',
    timer: {
      start: 1768511347385
    }
  }

  ctx.nr.completionId = '4bea415a30e702d45f5dd521c74b6216d209'
  ctx.nr.runId = 'run-1'
  ctx.nr.metadata = { foo: 'foo' }
})

test('creates entity', async (t) => {
  const msg = new LlmChatCompletionMessage({
    ...t.nr,
    sequence: 1,
    content: 'hello world',
    isResponse: true
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
  assert.equal(msg.role, 'assistant', 'should assume assistant role based on isResponse=true')
  assert.equal(msg.content, 'hello world')
  assert.equal(msg.completion_id, t.nr.completionId)
  assert.equal(msg.timestamp, undefined, 'should not have a timestamp defined if isResponse=true')
})

test('assigns role if given', async(t) => {
  const msg = new LlmChatCompletionMessage({
    ...t.nr,
    sequence: 1,
    content: 'hello world',
    role: 'system'
  })
  assert.equal(msg.role, 'system')
})

test('assigns role and timestamp correctly if isResponse is false', async(t) => {
  const msg = new LlmChatCompletionMessage({
    ...t.nr,
    sequence: 0,
    content: 'hello world',
    isResponse: false
  })
  assert.equal(msg.role, 'user', 'role should be user')
  assert.equal(msg.timestamp, t.nr.segment.timer.start, 'should have a timestamp defined if isResponse=false')
})

test('assigns id correctly', async (t) => {
  let msg = new LlmChatCompletionMessage({ ...t.nr, runId: '', sequence: 1 })
  assert.match(msg.id, /[a-z0-9-]{32}/)

  msg = new LlmChatCompletionMessage({ ...t.nr, runId: '123456', sequence: 42 })
  assert.equal(msg.id, '123456-42')
})

test('respects record_content setting', async (t) => {
  t.nr.agent.config.ai_monitoring.record_content.enabled = false
  const search = new LlmChatCompletionMessage({
    ...t.nr,
    sequence: 1,
    content: 'hello world'
  })
  assert.equal(search.content, undefined)
})
