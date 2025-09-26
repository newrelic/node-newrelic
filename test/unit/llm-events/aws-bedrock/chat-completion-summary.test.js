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
const LlmChatCompletionSummary = require('../../../../lib/llm-events/aws-bedrock/chat-completion-summary')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = {
    config: {
      applications() {
        return ['test-app']
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

  ctx.nr.transaction = {
    id: 'tx-1'
  }
  ctx.nr.segment = {
    getDurationInMillis() {
      return 100
    }
  }

  ctx.nr.bedrockCommand = {
    maxTokens: 25,
    temperature: 0.5,
    prompt: [
      { role: 'user', content: 'Hello!' }
    ],
    isClaude() {
      return false
    },
    isClaude3() {
      return false
    },
    isCohere() {
      return false
    },
    isTitan() {
      return false
    }
  }

  ctx.nr.bedrockResponse = {
    headers: {
      'x-amzn-request-id': 'aws-request-1'
    },
    finishReason: 'done',
    completions: ['completion-1']
  }
})

test('creates a basic summary', async (t) => {
  t.nr.bedrockResponse.inputTokenCount = 0
  t.nr.bedrockResponse.outputTokenCount = 0
  const event = new LlmChatCompletionSummary(t.nr)
  assert.equal(event['llm.conversation_id'], 'conversation-1')
  assert.equal(event.duration, 100)
  assert.equal(event['request.max_tokens'], 25)
  assert.equal(event['request.temperature'], 0.5)
  assert.equal(event['response.choices.finish_reason'], 'done')
  assert.equal(event['response.number_of_messages'], 2)
})

test('creates an claude summary', async (t) => {
  t.nr.bedrockCommand.isClaude = () => true
  const event = new LlmChatCompletionSummary(t.nr)
  assert.equal(event['llm.conversation_id'], 'conversation-1')
  assert.equal(event.duration, 100)
  assert.equal(event['request.max_tokens'], 25)
  assert.equal(event['request.temperature'], 0.5)
  assert.equal(event['response.choices.finish_reason'], 'done')
  assert.equal(event['response.number_of_messages'], 2)
})

test('creates a cohere summary', async (t) => {
  t.nr.bedrockCommand.isCohere = () => true
  const event = new LlmChatCompletionSummary(t.nr)
  assert.equal(event['llm.conversation_id'], 'conversation-1')
  assert.equal(event.duration, 100)
  assert.equal(event['request.max_tokens'], 25)
  assert.equal(event['request.temperature'], 0.5)
  assert.equal(event['response.choices.finish_reason'], 'done')
  assert.equal(event['response.number_of_messages'], 2)
})

test('creates a titan summary', async (t) => {
  t.nr.bedrockCommand.isTitan = () => true
  const event = new LlmChatCompletionSummary(t.nr)
  assert.equal(event['llm.conversation_id'], 'conversation-1')
  assert.equal(event.duration, 100)
  assert.equal(event['request.max_tokens'], 25)
  assert.equal(event['request.temperature'], 0.5)
  assert.equal(event['response.choices.finish_reason'], 'done')
  assert.equal(event['response.number_of_messages'], 2)
})

test('capture token usage attributes when response object includes input and output token usage information', async (t) => {
  t.nr.bedrockResponse.usage = {
    input_tokens: 30,
    output_tokens: 40
  }
  const event = new LlmChatCompletionSummary(t.nr)
  assert.equal(event['response.usage.prompt_tokens'], 30)
  assert.equal(event['response.usage.completion_tokens'], 40)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('capture token usage attributes when response object includes input and output token usage information - another format', async (t) => {
  t.nr.bedrockResponse.usage = {
    inputTokens: 30,
    outputTokens: 40,
  }
  const event = new LlmChatCompletionSummary(t.nr)
  assert.equal(event['response.usage.prompt_tokens'], 30)
  assert.equal(event['response.usage.completion_tokens'], 40)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('capture token usage attributes when response headers is missing total token count', async (t) => {
  t.nr.bedrockResponse.headers = {
    'x-amzn-bedrock-input-token-count': 30,
    'x-amzn-bedrock-output-token-count': 40,
  }
  const event = new LlmChatCompletionSummary(t.nr)
  assert.equal(event['response.usage.prompt_tokens'], 30)
  assert.equal(event['response.usage.completion_tokens'], 40)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('capture token usage attributes when response headers include all token usage information', async (t) => {
  t.nr.bedrockResponse.headers = {
    'x-amzn-bedrock-input-token-count': 30,
    'x-amzn-bedrock-output-token-count': 40,
    'x-amzn-bedrock-total-token-count': 70
  }
  const event = new LlmChatCompletionSummary(t.nr)
  assert.equal(event['response.usage.prompt_tokens'], 30)
  assert.equal(event['response.usage.completion_tokens'], 40)
  assert.equal(event['response.usage.total_tokens'], 70)
})

test('does not capture any token usage attributes when response is missing required usage information', async (t) => {
  t.nr.bedrockResponse.headers = {
    'x-amzn-bedrock-input-token-count': 30,
  }
  const event = new LlmChatCompletionSummary(t.nr)
  assert.equal(event['response.usage.prompt_tokens'], undefined)
  assert.equal(event['response.usage.completion_tokens'], undefined)
  assert.equal(event['response.usage.total_tokens'], undefined)
})
