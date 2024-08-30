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

test('all tests', async (t) => {
  t.beforeEach((ctx) => {
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
                    ['llm.conversation_id']: 'conversation-1'
                  }
                }
              }
            }
          }
        }
      }
    }

    ctx.nr.segment = {
      transaction: {
        id: 'tx-1'
      },
      getDurationInMillis() {
        return 100
      }
    }

    ctx.nr.bedrockCommand = {
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

    ctx.nr.bedrockResponse = {
      headers: {
        'x-amzn-request-id': 'aws-request-1'
      },
      finishReason: 'done',
      completions: ['completion-1']
    }
  })

  await t.test('creates a basic summary', async (ctx) => {
    ctx.nr.bedrockResponse.inputTokenCount = 0
    ctx.nr.bedrockResponse.outputTokenCount = 0
    const event = new LlmChatCompletionSummary(ctx.nr)
    assert.equal(event['llm.conversation_id'], 'conversation-1')
    assert.equal(event.duration, 100)
    assert.equal(event['request.max_tokens'], 25)
    assert.equal(event['request.temperature'], 0.5)
    assert.equal(event['response.choices.finish_reason'], 'done')
    assert.equal(event['response.number_of_messages'], 2)
  })

  await t.test('creates an ai21 summary', async (ctx) => {
    ctx.nr.bedrockCommand.isAi21 = () => true
    const event = new LlmChatCompletionSummary(ctx.nr)
    assert.equal(event['llm.conversation_id'], 'conversation-1')
    assert.equal(event.duration, 100)
    assert.equal(event['request.max_tokens'], 25)
    assert.equal(event['request.temperature'], 0.5)
    assert.equal(event['response.choices.finish_reason'], 'done')
    assert.equal(event['response.number_of_messages'], 2)
  })

  await t.test('creates an claude summary', async (ctx) => {
    ctx.nr.bedrockCommand.isClaude = () => true
    const event = new LlmChatCompletionSummary(ctx.nr)
    assert.equal(event['llm.conversation_id'], 'conversation-1')
    assert.equal(event.duration, 100)
    assert.equal(event['request.max_tokens'], 25)
    assert.equal(event['request.temperature'], 0.5)
    assert.equal(event['response.choices.finish_reason'], 'done')
    assert.equal(event['response.number_of_messages'], 2)
  })

  await t.test('creates a cohere summary', async (ctx) => {
    ctx.nr.bedrockCommand.isCohere = () => true
    const event = new LlmChatCompletionSummary(ctx.nr)
    assert.equal(event['llm.conversation_id'], 'conversation-1')
    assert.equal(event.duration, 100)
    assert.equal(event['request.max_tokens'], 25)
    assert.equal(event['request.temperature'], 0.5)
    assert.equal(event['response.choices.finish_reason'], 'done')
    assert.equal(event['response.number_of_messages'], 2)
  })

  await t.test('creates a llama2 summary', async (ctx) => {
    ctx.nr.bedrockCommand.isLlama2 = () => true
    const event = new LlmChatCompletionSummary(ctx.nr)
    assert.equal(event['llm.conversation_id'], 'conversation-1')
    assert.equal(event.duration, 100)
    assert.equal(event['request.max_tokens'], 25)
    assert.equal(event['request.temperature'], 0.5)
    assert.equal(event['response.choices.finish_reason'], 'done')
    assert.equal(event['response.number_of_messages'], 2)
  })

  await t.test('creates a titan summary', async (ctx) => {
    ctx.nr.bedrockCommand.isTitan = () => true
    const event = new LlmChatCompletionSummary(ctx.nr)
    assert.equal(event['llm.conversation_id'], 'conversation-1')
    assert.equal(event.duration, 100)
    assert.equal(event['request.max_tokens'], 25)
    assert.equal(event['request.temperature'], 0.5)
    assert.equal(event['response.choices.finish_reason'], 'done')
    assert.equal(event['response.number_of_messages'], 2)
  })
})
