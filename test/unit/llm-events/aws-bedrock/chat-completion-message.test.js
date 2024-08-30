/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const {
  DESTINATIONS: { TRANS_SCOPE }
} = require('../../../../lib/config/attribute-filter')
const LlmChatCompletionMessage = require('../../../../lib/llm-events/aws-bedrock/chat-completion-message')

test('all tests', async (t) => {
  t.beforeEach((ctx) => {
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
                    ['llm.conversation_id']: 'conversation-1'
                  }
                }
              }
            }
          }
        }
      }
    }

    ctx.nr.completionId = 'completion-1'

    ctx.nr.content = 'a prompt'

    ctx.nr.segment = {
      id: 'segment-1',
      transaction: {
        id: 'tx-1',
        traceId: 'trace-1'
      }
    }

    ctx.nr.bedrockResponse = {
      headers: {
        'x-amzn-requestid': 'request-1'
      },
      get inputTokenCount() {
        return 8
      },
      get outputTokenCount() {
        return 4
      }
    }

    ctx.nr.bedrockCommand = {
      id: 'cmd-1',
      prompt: 'who are you',
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
      isTitan() {
        return false
      }
    }
  })

  await t.test('create creates a non-response instance', async (ctx) => {
    ctx.nr.agent.llm.tokenCountCallback = () => 3
    const event = new LlmChatCompletionMessage(ctx.nr)
    assert.equal(event.is_response, false)
    assert.equal(event['llm.conversation_id'], 'conversation-1')
    assert.equal(event.completion_id, 'completion-1')
    assert.equal(event.sequence, 0)
    assert.equal(event.content, 'who are you')
    assert.equal(event.role, 'user')
    assert.match(event.id, /[\w-]{36}/)
    assert.equal(event.token_count, 3)
  })

  await t.test('create creates a titan response instance', async (ctx) => {
    ctx.nr.bedrockCommand.isTitan = () => true
    ctx.nr.content = 'a response'
    ctx.nr.isResponse = true
    const event = new LlmChatCompletionMessage(ctx.nr)
    assert.equal(event.is_response, true)
    assert.equal(event['llm.conversation_id'], 'conversation-1')
    assert.equal(event.completion_id, 'completion-1')
    assert.equal(event.sequence, 0)
    assert.equal(event.content, 'a response')
    assert.equal(event.role, 'assistant')
    assert.match(event.id, /[\w-]{36}-0/)
  })

  await t.test('create creates a cohere response instance', async (ctx) => {
    ctx.nr.bedrockCommand.isCohere = () => true
    ctx.nr.content = 'a response'
    ctx.nr.isResponse = true
    ctx.nr.bedrockResponse.id = 42
    const event = new LlmChatCompletionMessage(ctx.nr)
    assert.equal(event.is_response, true)
    assert.equal(event['llm.conversation_id'], 'conversation-1')
    assert.equal(event.completion_id, 'completion-1')
    assert.equal(event.sequence, 0)
    assert.equal(event.content, 'a response')
    assert.equal(event.role, 'assistant')
    assert.match(event.id, /42-0/)
  })

  await t.test(
    'create creates a ai21 response instance when response.id is undefined',
    async (ctx) => {
      ctx.nr.bedrockCommand.isAi21 = () => true
      ctx.nr.content = 'a response'
      ctx.nr.isResponse = true
      delete ctx.nr.bedrockResponse.id
      const event = new LlmChatCompletionMessage(ctx.nr)
      assert.equal(event.is_response, true)
      assert.equal(event['llm.conversation_id'], 'conversation-1')
      assert.equal(event.completion_id, 'completion-1')
      assert.equal(event.sequence, 0)
      assert.equal(event.content, 'a response')
      assert.equal(event.role, 'assistant')
      assert.match(event.id, /[\w-]{36}-0/)
    }
  )

  await t.test(
    'should not capture content when `ai_monitoring.record_content.enabled` is false',
    async (ctx) => {
      const { agent } = ctx.nr
      agent.config.ai_monitoring.record_content.enabled = false
      const event = new LlmChatCompletionMessage(ctx.nr)
      assert.equal(event.content, undefined, 'content should be empty')
    }
  )
})
