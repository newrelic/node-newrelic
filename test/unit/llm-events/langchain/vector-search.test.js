/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmVectorSearch = require('#agentlib/llm-events/langchain/vector-search.js')

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

  ctx.nr.transaction = {
    traceId: 'trace-1'
  }
  ctx.nr.segment = {
    id: 'segment-1',
    getDurationInMillis() {
      return 42
    }
  }
})

test('create entity', async (t) => {
  const search = new LlmVectorSearch({
    ...t.nr,
    query: 'hello world',
    k: 1
  })
  assert.match(search.id, /[a-z0-9-]{36}/)
  assert.equal(search.appName, 'test-app')
  assert.equal(search['llm.conversation_id'], 'test-conversation')
  assert.equal(search.span_id, 'segment-1')
  assert.equal(search.trace_id, 'trace-1')
  assert.equal(search.ingest_source, 'Node')
  assert.equal(search.vendor, 'langchain')
  assert.equal(search['request.query'], 'hello world')
  assert.equal(search['request.k'], 1)
  assert.equal(search.duration, 42)
  assert.equal(search['response.number_of_documents'], 0)
})

test('respects record_content setting', async (t) => {
  t.nr.agent.config.ai_monitoring.record_content.enabled = false
  const search = new LlmVectorSearch({
    ...t.nr,
    k: 1,
    query: 'hello world'
  })
  assert.equal(search.page_content, undefined)
})
