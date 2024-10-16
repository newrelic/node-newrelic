/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LangChainEvent = require('../../../../lib/llm-events/langchain/event')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.transaction = {
    traceId: 'trace-1',
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

  ctx.nr.agent = {
    config: {
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
    id: 'segment-1'
  }

  ctx.nr.runId = 'run-1'
  ctx.nr.metadata = { foo: 'foo' }
})

test('constructs default instance', async (t) => {
  const event = new LangChainEvent(t.nr)
  assert.match(event.id, /[a-z0-9-]{36}/)
  assert.equal(event.appName, 'test-app')
  assert.equal(event['llm.conversation_id'], 'test-conversation')
  assert.equal(event.span_id, 'segment-1')
  assert.equal(event.request_id, 'run-1')
  assert.equal(event.trace_id, 'trace-1')
  assert.equal(event['metadata.foo'], 'foo')
  assert.equal(event.ingest_source, 'Node')
  assert.equal(event.vendor, 'langchain')
  assert.equal(event.error, null)
  assert.equal(event.virtual_llm, true)
})

test('params.virtual is handled correctly', async (t) => {
  const event = new LangChainEvent({ ...t.nr, virtual: false })
  assert.equal(event.virtual_llm, false)

  try {
    const _ = new LangChainEvent({ ...t.nr, virtual: 'false' })
    assert.fail(_)
  } catch (error) {
    assert.equal(error.message, 'params.virtual must be a primitive boolean')
  }
})

test('langchainMeta is parsed correctly', async (t) => {
  const event = new LangChainEvent(t.nr)
  event.langchainMeta = 'foobar'
  assert.deepStrictEqual(event['metadata.foo'], 'foo')
  assert.equal(Object.keys(event).filter((k) => k.startsWith('metadata.')).length, 1)
})

test('metadata is parsed correctly', async (t) => {
  const event = new LangChainEvent(t.nr)
  assert.equal(event['llm.foo'], 'bar')
  assert.equal(event['llm.bar'], 'baz')
  assert.ok(!event.customKey)
})

test('sets tags from array', async (t) => {
  t.nr.tags = ['foo', 'bar']
  const msg = new LangChainEvent(t.nr)
  assert.equal(msg.tags, 'foo,bar')
})

test('sets tags from string', async (t) => {
  t.nr.tags = 'foo,bar'
  const msg = new LangChainEvent(t.nr)
  assert.equal(msg.tags, 'foo,bar')
})

test('sets error property', async (t) => {
  t.nr.error = true
  const msg = new LangChainEvent(t.nr)
  assert.equal(msg.error, true)
})
