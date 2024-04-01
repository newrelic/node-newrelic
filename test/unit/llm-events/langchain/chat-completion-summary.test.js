/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LangChainCompletionSummary = require('../../../../lib/llm-events/langchain/chat-completion-summary')

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
      traceId: 'trace-1'
    },
    getDurationInMillis() {
      return 42
    }
  }

  t.context.runId = 'run-1'
  t.context.metadata = { foo: 'foo' }
})

tap.test('creates entity', async (t) => {
  const msg = new LangChainCompletionSummary(t.context)
  t.match(msg, {
    id: /[a-z0-9-]{36}/,
    appName: 'test-app',
    ['llm.conversation_id']: 'test-conversation',
    span_id: 'segment-1',
    request_id: 'run-1',
    trace_id: 'trace-1',
    ['metadata.foo']: 'foo',
    ingest_source: 'Node',
    vendor: 'langchain',
    virtual_llm: true,
    tags: '',
    duration: 42,
    ['response.number_of_messages']: 0
  })
})
