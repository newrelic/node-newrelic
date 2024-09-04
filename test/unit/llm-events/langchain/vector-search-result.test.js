/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LangChainVectorSearchResult = require('../../../../lib/llm-events/langchain/vector-search-result')
const LangChainVectorSearch = require('../../../../lib/llm-events/langchain/vector-search')

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
    },
    getDurationInMillis() {
      return 42
    }
  }

  ctx.nr.runId = 'run-1'
  ctx.nr.metadata = { foo: 'foo' }
})

test('create entity', async (t) => {
  const search = new LangChainVectorSearch({
    ...t.nr,
    query: 'hello world',
    k: 1
  })

  const searchResult = new LangChainVectorSearchResult({
    ...t.nr,
    sequence: 1,
    pageContent: 'hello world',
    search_id: search.id
  })
  assert.match(searchResult.id, /[a-z0-9-]{36}/)
  assert.equal(searchResult.appName, 'test-app')
  assert.equal(searchResult['llm.conversation_id'], 'test-conversation')
  assert.equal(searchResult.span_id, 'segment-1')
  assert.equal(searchResult.request_id, 'run-1')
  assert.equal(searchResult.trace_id, 'trace-1')
  assert.equal(searchResult['metadata.foo'], 'foo')
  assert.equal(searchResult.ingest_source, 'Node')
  assert.equal(searchResult.vendor, 'langchain')
  assert.equal(searchResult.virtual_llm, true)
  assert.equal(searchResult.sequence, 1)
  assert.equal(searchResult.page_content, 'hello world')
  assert.equal(searchResult.search_id, search.id)
})

test('respects record_content setting', async (t) => {
  t.nr.agent.config.ai_monitoring.record_content.enabled = false
  const search = new LangChainVectorSearchResult({
    ...t.nr,
    sequence: 1,
    pageContent: 'hello world'
  })
  assert.equal(search.page_content, undefined)
})
