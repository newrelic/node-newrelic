/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LangChainEvent = require('../../../../lib/llm-events/langchain/event')

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
    }
  }

  t.context.runId = 'run-1'
  t.context.metadata = { foo: 'foo' }
})

tap.test('constructs default instance', async (t) => {
  const event = new LangChainEvent(t.context)
  t.match(event, {
    id: /[a-z0-9-]{36}/,
    appName: 'test-app',
    conversation_id: 'test-conversation',
    span_id: 'segment-1',
    request_id: 'run-1',
    transaction_id: 'tx-1',
    trace_id: 'trace-1',
    metadata: { foo: 'foo' },
    ingest_source: 'Node',
    vendor: 'langchain',
    virtual_llm: true
  })
})

tap.test('params.virtual is handled correctly', async (t) => {
  const event = new LangChainEvent({ ...t.context, virtual: false })
  t.equal(event.virtual_llm, false)

  try {
    const _ = new LangChainEvent({ ...t.context, virtual: 'false' })
    t.fail(_)
  } catch (error) {
    t.match(error, /params\.virtual must be a primitive boolean/)
  }
})

tap.test('metadata is parsed correctly', async (t) => {
  const event = new LangChainEvent(t.context)
  event.metadata = 'foobar'
  t.same(event.metadata, { foo: 'foo' })
})
