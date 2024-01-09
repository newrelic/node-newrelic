/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LlmChatCompletionSummary = require('../../../lib/llm/chat-completion-summary')

tap.beforeEach((t) => {
  t.context.agent = {
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
                t.equal(key, 0x01 | 0x02 | 0x04 | 0x08)
                return {
                  ['llm.conversation_id']: 'conversation-1'
                }
              }
            }
          }
        }
      }
    }
  }

  t.context.segment = {
    transaction: {
      id: 'tx-1'
    },
    getDurationInMillis() {
      return 100
    }
  }

  t.context.bedrockCommand = {
    maxTokens: 25,
    temperature: 0.5,
    isAi21() {
      return false
    },
    isClaude() {
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

  t.context.bedrockResponse = {
    headers: {
      'x-amzn-request-id': 'aws-request-1'
    },
    finishReason: 'done',
    completions: ['completion-1'],
    inputTokenCount: 25,
    outputTokenCount: 25
  }
})

tap.test('creates a basic summary', async (t) => {
  t.context.bedrockResponse.inputTokenCount = 0
  t.context.bedrockResponse.outputTokenCount = 0
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event.conversation_id, 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.usage.total_tokens'], 0)
  t.equal(event['response.usage.prompt_tokens'], 0)
  t.equal(event['response.usage.completion_tokens'], 0)
  t.equal(event['response.number_of_messages'], undefined)
})

tap.test('creates an ai21 summary', async (t) => {
  t.context.bedrockCommand.isAi21 = () => true
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event.conversation_id, 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.usage.total_tokens'], 50)
  t.equal(event['response.usage.prompt_tokens'], 25)
  t.equal(event['response.usage.completion_tokens'], 25)
  t.equal(event['response.number_of_messages'], 2)
})

tap.test('creates an claude summary', async (t) => {
  t.context.bedrockCommand.isClaude = () => true
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event.conversation_id, 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.usage.total_tokens'], 50)
  t.equal(event['response.usage.prompt_tokens'], 25)
  t.equal(event['response.usage.completion_tokens'], 25)
  t.equal(event['response.number_of_messages'], 2)
})

tap.test('creates a cohere summary', async (t) => {
  t.context.bedrockCommand.isCohere = () => true
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event.conversation_id, 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.usage.total_tokens'], 50)
  t.equal(event['response.usage.prompt_tokens'], 25)
  t.equal(event['response.usage.completion_tokens'], 25)
  t.equal(event['response.number_of_messages'], 2)
})

tap.test('creates a llama2 summary', async (t) => {
  t.context.bedrockCommand.isLlama2 = () => true
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event.conversation_id, 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.usage.total_tokens'], 50)
  t.equal(event['response.usage.prompt_tokens'], 25)
  t.equal(event['response.usage.completion_tokens'], 25)
  t.equal(event['response.number_of_messages'], 2)
})

tap.test('creates a titan summary', async (t) => {
  t.context.bedrockCommand.isTitan = () => true
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event.conversation_id, 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.usage.total_tokens'], 50)
  t.equal(event['response.usage.prompt_tokens'], 25)
  t.equal(event['response.usage.completion_tokens'], 25)
  t.equal(event['response.number_of_messages'], 2)
})
