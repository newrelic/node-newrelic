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
      applications() {
        return ['test-app']
      },
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
  }

  ctx.nr.input = 'who are you'

  ctx.nr.bedrockResponse = {
    headers: {
      'x-amzn-requestid': 'request-1'
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
  assert.equal(event.input, 'who are you')
  assert.equal(event.duration, 1.008)
  assert.equal(event.token_count, undefined)
})

test('should not capture input when `ai_monitoring.record_content.enabled` is false', async (t) => {
  const { agent } = t.nr
  agent.config.ai_monitoring.record_content.enabled = false
  const event = new LlmEmbedding(t.nr)
  assert.equal(event.input, undefined, 'input should be empty')
})

test('capture total token usage attribute when response object includes total token usage information', async (t) => {
  t.nr.bedrockResponse.usage = {
    input_tokens: 70
  }
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('capture total token usage attribute when response object includes total token usage information - another format', async (t) => {
  t.nr.bedrockResponse.usage = {
    inputTokens: 70
  }
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('capture total token usage attributes when response headers includes total token usage information', async (t) => {
  t.nr.bedrockResponse.headers = {
    'x-amzn-bedrock-input-token-count': 70
  }
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('does not capture total token usage attributes when response headers is missing total token count', async (t) => {
  t.nr.bedrockResponse.headers = {}
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.total_tokens'], undefined)
})

test('does not capture total token usage attributes when response headers is missing total token count', async (t) => {
  t.nr.bedrockResponse.usage = {}
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
