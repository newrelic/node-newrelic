/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const {
  DESTINATIONS: { TRANS_SCOPE }
} = require('../../../../lib/config/attribute-filter')
const LlmEmbedding = require('../../../../lib/llm-events/aws-bedrock/embedding')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = {
    llm: {},
    config: {
      ai_monitoring: {
        enabled: true,
        record_content: {
          enabled: true
        }
      }
    },
    tracer: {
      getTransaction() {
        return {
          trace: {
            custom: {
              get(key) {
                assert.equal(key, TRANS_SCOPE)
                return {
                  'llm.conversation_id': 'conversation-1'
                }
              }
            }
          }
        }
      }
    }
  }

  ctx.nr.bedrockCommand = {
    modelId: 'some-model'
  }

  ctx.nr.requestInput = 'who are you'

  ctx.nr.bedrockResponse = {
    requestId: 'request-1',
    get totalTokenCount() {
      return 70
    }
  }
  ctx.nr.transaction = {
    traceId: 'id'
  }
  ctx.nr.segment = {
    getDurationInMillis() {
      return 1.008
    }
  }
})

test('creates a basic embedding', async (t) => {
  const event = new LlmEmbedding(t.nr)
  assert.equal(event.duration, 1.008)
  assert.match(event.id, /\w{32}/)
  assert.equal(event.ingest_source, 'Node')
  assert.equal(event.input, 'who are you')
  assert.equal(event['llm.conversation_id'], 'conversation-1')
  assert.equal(event.request_id, 'request-1')
  assert.equal(event['request.model'], 'some-model')
  assert.equal(event['response.model'], 'some-model')
  assert.equal(event.trace_id, 'id')
  assert.equal(event.vendor, 'bedrock')
})

test('should not capture input when `ai_monitoring.record_content.enabled` is false', async (t) => {
  const { agent } = t.nr
  agent.config.ai_monitoring.record_content.enabled = false
  const event = new LlmEmbedding(t.nr)
  assert.equal(event.input, undefined, 'input should be empty')
})

test('capture total token usage attribute when totalTokenCount is set', async (t) => {
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('does not capture total token usage when totalTokenCount is not set', async (t) => {
  Object.defineProperty(t.nr.bedrockResponse, 'totalTokenCount', {
    get() {
      return undefined
    }
  })
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.total_tokens'], undefined)
})

test('should use token callback to set total token usage attribute', async (t) => {
  function cb(model, content) {
    return 65
  }
  t.nr.agent.llm.tokenCountCallback = cb
  const event = new LlmEmbedding(t.nr)

  assert.equal(event['response.usage.total_tokens'], 65)
})
