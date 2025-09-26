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

test('capture token usage attributes when response object includes input and output token usage information', async (t) => {
  t.nr.bedrockResponse.usage = {
    input_tokens: 30,
    output_tokens: 40,
  }
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.prompt_tokens'], 30)
  assert.equal(event['response.usage.completion_tokens'], 40)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('capture token usage attributes when response object includes all token usage information - another format', async (t) => {
  t.nr.bedrockResponse.usage = {
    inputTokens: 30,
    outputTokens: 40,
  }
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.prompt_tokens'], 30)
  assert.equal(event['response.usage.completion_tokens'], 40)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('capture token usage attributes when response object is missing totalTokens', async (t) => {
  t.nr.bedrockResponse.usage = {
    inputTokens: 30,
    outputTokens: 40,
  }
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.prompt_tokens'], 30)
  assert.equal(event['response.usage.completion_tokens'], 40)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('capture token usage attributes when response headers includes input and output token usage information', async (t) => {
  t.nr.bedrockResponse.headers = {
    'x-amzn-bedrock-input-token-count': 30,
    'x-amzn-bedrock-output-token-count': 40,
    'x-amzn-bedrock-total-token-count': 70
  }
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.prompt_tokens'], 30)
  assert.equal(event['response.usage.completion_tokens'], 40)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('capture token usage attributes when response headers is missing total token count', async (t) => {
  t.nr.bedrockResponse.headers = {
    'x-amzn-bedrock-input-token-count': 30,
    'x-amzn-bedrock-output-token-count': 40,
  }
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.prompt_tokens'], 30)
  assert.equal(event['response.usage.completion_tokens'], 40)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('does not capture any token usage attributes when response is missing required usage information', async (t) => {
  t.nr.bedrockResponse.headers = {
    'x-amzn-bedrock-input-token-count': 30,
  }
  const event = new LlmEmbedding(t.nr)
  assert.equal(event['response.usage.prompt_tokens'], undefined)
  assert.equal(event['response.usage.completion_tokens'], undefined)
  assert.equal(event['response.usage.total_tokens'], undefined)
})
