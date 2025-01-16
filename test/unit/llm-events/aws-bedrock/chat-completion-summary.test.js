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
    isAi21() {
      return false
    },
    isClaude() {
      return false
    },
    isClaude3() {
      return false
    },
    isCohere() {
      return false
    },
    isLlama2() {
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

test('creates an ai21 summary', async (t) => {
  t.nr.bedrockCommand.isAi21 = () => true
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

test('creates a llama2 summary', async (t) => {
  t.nr.bedrockCommand.isLlama2 = () => true
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
