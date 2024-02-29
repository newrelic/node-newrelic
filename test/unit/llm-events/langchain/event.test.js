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
            'llm.conversation_id': 'test-conversation',
            'llm.foo': 'bar',
            'llm.bar': 'baz',
            'customKey': 'customValue'
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
    ['llm.conversation_id']: 'test-conversation',
    span_id: 'segment-1',
    request_id: 'run-1',
    transaction_id: 'tx-1',
    trace_id: 'trace-1',
    ['metadata.foo']: 'foo',
    ingest_source: 'Node',
    vendor: 'langchain',
    error: null,
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

tap.test('langchainMeta is parsed correctly', async (t) => {
  const event = new LangChainEvent(t.context)
  event.langchainMeta = 'foobar'
  t.same(event['metadata.foo'], 'foo')
  t.equal(Object.keys(event).filter((k) => k.startsWith('metadata.')).length, 1)
})

tap.test('metadata is parsed correctly', async (t) => {
  const event = new LangChainEvent(t.context)
  t.equal(event['llm.foo'], 'bar')
  t.equal(event['llm.bar'], 'baz')
  t.notOk(event.customKey)
})

tap.test('sets tags from array', async (t) => {
  t.context.tags = ['foo', 'bar']
  const msg = new LangChainEvent(t.context)
  t.equal(msg.tags, 'foo,bar')
})

tap.test('sets tags from string', async (t) => {
  t.context.tags = 'foo,bar'
  const msg = new LangChainEvent(t.context)
  t.equal(msg.tags, 'foo,bar')
})

tap.test('sets error property', async (t) => {
  t.context.error = true
  const msg = new LangChainEvent(t.context)
  t.equal(msg.error, true)
})
