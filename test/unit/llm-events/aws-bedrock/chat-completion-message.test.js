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
const LlmChatCompletionMessage = require('../../../../lib/llm-events/aws-bedrock/chat-message')

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

  ctx.nr.completionId = 'completion-1'

  ctx.nr.content = 'a prompt'

  ctx.nr.transaction = {
    id: 'tx-1',
    traceId: 'trace-1'
  }
  ctx.nr.segment = {
    id: 'segment-1',
    timer: {
      start: 1769119395346
    }
  }
  ctx.nr.role = 'assistant'

  ctx.nr.bedrockResponse = {
    headers: {
      'x-amzn-requestid': 'request-1'
    },
    get inputTokenCount() {
      return 8
    },
    get outputTokenCount() {
      return 4
    },
    completions: ['a completion']
  }

  ctx.nr.bedrockCommand = {
    id: 'cmd-1',
    prompt: [{ content: 'a prompt' }],
    modelId: 'model-1',
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

test('create creates a non-response instance', async (t) => {
  t.nr.agent.llm.tokenCountCallback = () => 3
  t.nr.role = 'user'
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event['llm.conversation_id'], 'conversation-1')
  assert.equal(event.completion_id, 'completion-1')
  assert.equal(event.sequence, 0)
  assert.equal(event.content, 'a prompt')
  assert.equal(event.role, 'user')
  assert.match(event.id, /[\w-]{36}/)
  assert.equal(event.token_count, 0)
})

test('create creates a titan response instance', async (t) => {
  t.nr.bedrockCommand.isTitan = () => true
  t.nr.content = 'a response'
  t.nr.isResponse = true
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.is_response, true)
  assert.equal(event['llm.conversation_id'], 'conversation-1')
  assert.equal(event.completion_id, 'completion-1')
  assert.equal(event.sequence, 0)
  assert.equal(event.content, 'a response')
  assert.equal(event.role, 'assistant')
  assert.match(event.id, /[\w-]{36}/)
})

test('create creates a cohere response instance', async (t) => {
  t.nr.bedrockCommand.isCohere = () => true
  t.nr.content = 'a response'
  t.nr.isResponse = true
  t.nr.bedrockResponse.id = 42
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.is_response, true)
  assert.equal(event['llm.conversation_id'], 'conversation-1')
  assert.equal(event.completion_id, 'completion-1')
  assert.equal(event.sequence, 0)
  assert.equal(event.content, 'a response')
  assert.equal(event.role, 'assistant')
  assert.match(event.id, /42-0/)
})

test('should not capture content when `ai_monitoring.record_content.enabled` is false', async (t) => {
  const { agent } = t.nr
  agent.config.ai_monitoring.record_content.enabled = false
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.content, undefined, 'content should be empty')
})

test('should capture token_count even when `ai_monitoring.record_content.enabled` is false', async (t) => {
  const { agent } = t.nr
  agent.config.ai_monitoring.record_content.enabled = false
  t.nr.agent.llm.tokenCountCallback = () => 3
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.token_count, 0)
})

test('should capture token_count when callback is defined', async (t) => {
  const { agent } = t.nr
  agent.llm.tokenCountCallback = () => 3
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.token_count, 0)
})

test('should not set token_count if callback registered returns is less than 0', async (t) => {
  const { agent } = t.nr
  agent.llm.tokenCountCallback = () => -1
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.token_count, undefined)
})

test('should not set token_count if callback registered returns null', async (t) => {
  const { agent } = t.nr
  t.nr.isResponse = true

  agent.llm.tokenCountCallback = () => null
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.token_count, undefined)
})

test('should not set token_count if inputTokenCount and outputTokenCount are not on response', async (t) => {
  Object.defineProperty(t.nr.bedrockResponse, 'inputTokenCount', {
    get() { return null }
  })
  Object.defineProperty(t.nr.bedrockResponse, 'outputTokenCount', {
    get() { return null }
  })
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.token_count, undefined)
})

test('should not set token_count if inputTokenCount is set but not outputTokenCount', async (t) => {
  Object.defineProperty(t.nr.bedrockResponse, 'outputTokenCount', {
    get() { return null }
  })
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.token_count, undefined)
})

test('should not set token_count if outputTokenCount is set but not inputTokenCount', async (t) => {
  Object.defineProperty(t.nr.bedrockResponse, 'inputTokenCount', {
    get() { return null }
  })
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.token_count, undefined)
})

test('should set token_count to 0 if inputTokenCount and outputTokenCount are on response', async (t) => {
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.token_count, 0)
})

test('should set timestamp if request/input msg', async (t) => {
  t.nr.role = 'user'
  t.nr.isResponse = false
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.timestamp, t.nr.segment.timer.start)
})

test('should not set timestamp if response msg', async (t) => {
  t.nr.isResponse = true
  const event = new LlmChatCompletionMessage(t.nr)
  assert.equal(event.timestamp, undefined)
})
