/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LangChainVectorSearchResult = require('../../../../lib/llm-events/langchain/vector-search-result')

tap.beforeEach((t) => {
  t.context._tx = {
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

  t.context.agent = {
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
        return t.context._tx
      }
    }
  }

  t.context.segment = {
    id: 'segment-1',
    transaction: {
      id: 'tx-1',
      traceId: 'trace-1'
    }
  }

  t.context.runId = 'run-1'
  t.context.metadata = { foo: 'foo' }
})

tap.test('create entity', async (t) => {
  const search = new LangChainVectorSearchResult({
    ...t.context,
    sequence: 1,
    pageContent: 'hello world'
  })
  t.match(search, {
    id: /[a-z0-9-]{36}/,
    appName: 'test-app',
    ['llm.conversation_id']: 'test-conversation',
    request_id: 'run-1',
    span_id: 'segment-1',
    transaction_id: 'tx-1',
    trace_id: 'trace-1',
    ['metadata.foo']: 'foo',
    ingest_source: 'Node',
    vendor: 'langchain',
    virtual_llm: true,
    sequence: 1,
    page_content: 'hello world',
    search_id: /[a-z0-9-]{36}/
  })
})

tap.test('respects record_content setting', async (t) => {
  t.context.agent.config.ai_monitoring.record_content.enabled = false
  const search = new LangChainVectorSearchResult({
    ...t.context,
    sequence: 1,
    pageContent: 'hello world'
  })
  t.equal(search.page_content, undefined)
})
