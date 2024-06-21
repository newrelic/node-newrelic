/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const {
  DESTINATIONS: { TRANS_SCOPE }
} = require('../../../../lib/config/attribute-filter')
const LlmChatCompletionSummary = require('../../../../lib/llm-events/aws-bedrock/chat-completion-summary')

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
                t.equal(key, TRANS_SCOPE)
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

  t.context.bedrockResponse = {
    headers: {
      'x-amzn-request-id': 'aws-request-1'
    },
    finishReason: 'done',
    completions: ['completion-1']
  }
})

tap.test('creates a basic summary', async (t) => {
  t.context.bedrockResponse.inputTokenCount = 0
  t.context.bedrockResponse.outputTokenCount = 0
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event['llm.conversation_id'], 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.number_of_messages'], 2)
})

tap.test('creates an ai21 summary', async (t) => {
  t.context.bedrockCommand.isAi21 = () => true
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event['llm.conversation_id'], 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.number_of_messages'], 2)
})

tap.test('creates an claude summary', async (t) => {
  t.context.bedrockCommand.isClaude = () => true
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event['llm.conversation_id'], 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.number_of_messages'], 2)
})

tap.test('creates a cohere summary', async (t) => {
  t.context.bedrockCommand.isCohere = () => true
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event['llm.conversation_id'], 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.number_of_messages'], 2)
})

tap.test('creates a llama2 summary', async (t) => {
  t.context.bedrockCommand.isLlama2 = () => true
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event['llm.conversation_id'], 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.number_of_messages'], 2)
})

tap.test('creates a titan summary', async (t) => {
  t.context.bedrockCommand.isTitan = () => true
  const event = new LlmChatCompletionSummary(t.context)
  t.equal(event['llm.conversation_id'], 'conversation-1')
  t.equal(event.duration, 100)
  t.equal(event['request.max_tokens'], 25)
  t.equal(event['request.temperature'], 0.5)
  t.equal(event['response.choices.finish_reason'], 'done')
  t.equal(event['response.number_of_messages'], 2)
})
