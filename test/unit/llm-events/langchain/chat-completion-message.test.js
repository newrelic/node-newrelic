/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LangChainCompletionMessage = require('../../../../lib/llm-events/langchain/chat-completion-message')

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

tap.test('creates entity', async (t) => {
  const msg = new LangChainCompletionMessage({
    ...t.context,
    sequence: 1,
    content: 'hello world'
  })
  t.match(msg, {
    id: 'run-1-1',
    appName: 'test-app',
    ['llm.conversation_id']: 'test-conversation',
    span_id: 'segment-1',
    request_id: 'run-1',
    transaction_id: 'tx-1',
    trace_id: 'trace-1',
    ['metadata.foo']: 'foo',
    ingest_source: 'Node',
    vendor: 'langchain',
    virtual_llm: true,
    sequence: 1,
    content: 'hello world',
    completion_id: /[a-z0-9-]{36}/
  })
})

tap.test('assigns id correctly', async (t) => {
  let msg = new LangChainCompletionMessage({ ...t.context, runId: '', sequence: 1 })
  t.match(msg.id, /[a-z0-9-]{36}-1/)

  msg = new LangChainCompletionMessage({ ...t.context, runId: '123456', sequence: 42 })
  t.equal(msg.id, '123456-42')
})

tap.test('respects record_content setting', async (t) => {
  t.context.agent.config.ai_monitoring.record_content.enabled = false
  const search = new LangChainCompletionMessage({
    ...t.context,
    sequence: 1,
    content: 'hello world'
  })
  t.equal(search.content, undefined)
})
