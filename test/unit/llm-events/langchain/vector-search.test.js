/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LangChainVectorSearch = require('../../../../lib/llm-events/langchain/vector-search')

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
    },
    getDurationInMillis() {
      return 42
    }
  }
  t.context.runId = 'run-1'
})

tap.test('create entity', async (t) => {
  const search = new LangChainVectorSearch({
    ...t.context,
    query: 'hello world',
    k: 1
  })
  t.match(search, {
    'id': /[a-z0-9-]{36}/,
    'appName': 'test-app',
    ['llm.conversation_id']: 'test-conversation',
    'request_id': 'run-1',
    'span_id': 'segment-1',
    'transaction_id': 'tx-1',
    'trace_id': 'trace-1',
    'ingest_source': 'Node',
    'vendor': 'langchain',
    'virtual_llm': true,
    'request.query': 'hello world',
    'request.k': 1,
    'duration': 42,
    'response.number_of_documents': 0
  })
})
