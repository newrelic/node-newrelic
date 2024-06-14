/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const {
  DESTINATIONS: { TRANS_SCOPE }
} = require('../../../../lib/config/attribute-filter')
const LlmChatCompletionMessage = require('../../../../lib/llm-events/aws-bedrock/chat-completion-message')

tap.beforeEach((t) => {
  t.context.agent = {
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

  t.context.completionId = 'completion-1'

  t.context.content = 'a prompt'

  t.context.segment = {
    id: 'segment-1',
    transaction: {
      id: 'tx-1',
      traceId: 'trace-1'
    }
  }

  t.context.bedrockResponse = {
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

  t.context.bedrockCommand = {
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

tap.test('create creates a non-response instance', async (t) => {
  t.context.agent.llm.tokenCountCallback = () => 3
  const event = new LlmChatCompletionMessage(t.context)
  t.equal(event.is_response, false)
  t.equal(event['llm.conversation_id'], 'conversation-1')
  t.equal(event.completion_id, 'completion-1')
  t.equal(event.sequence, 0)
  t.equal(event.content, 'who are you')
  t.equal(event.role, 'user')
  t.match(event.id, /[\w-]{36}/)
  t.equal(event.token_count, 3)
})

tap.test('create creates a titan response instance', async (t) => {
  t.context.bedrockCommand.isTitan = () => true
  t.context.content = 'a response'
  t.context.isResponse = true
  const event = new LlmChatCompletionMessage(t.context)
  t.equal(event.is_response, true)
  t.equal(event['llm.conversation_id'], 'conversation-1')
  t.equal(event.completion_id, 'completion-1')
  t.equal(event.sequence, 0)
  t.equal(event.content, 'a response')
  t.equal(event.role, 'assistant')
  t.match(event.id, /[\w-]{36}-0/)
})

tap.test('create creates a cohere response instance', async (t) => {
  t.context.bedrockCommand.isCohere = () => true
  t.context.content = 'a response'
  t.context.isResponse = true
  t.context.bedrockResponse.id = 42
  const event = new LlmChatCompletionMessage(t.context)
  t.equal(event.is_response, true)
  t.equal(event['llm.conversation_id'], 'conversation-1')
  t.equal(event.completion_id, 'completion-1')
  t.equal(event.sequence, 0)
  t.equal(event.content, 'a response')
  t.equal(event.role, 'assistant')
  t.match(event.id, /42-0/)
})

tap.test('create creates a ai21 response instance when response.id is undefined', async (t) => {
  t.context.bedrockCommand.isAi21 = () => true
  t.context.content = 'a response'
  t.context.isResponse = true
  delete t.context.bedrockResponse.id
  const event = new LlmChatCompletionMessage(t.context)
  t.equal(event.is_response, true)
  t.equal(event['llm.conversation_id'], 'conversation-1')
  t.equal(event.completion_id, 'completion-1')
  t.equal(event.sequence, 0)
  t.equal(event.content, 'a response')
  t.equal(event.role, 'assistant')
  t.match(event.id, /[\w-]{36}-0/)
})

tap.test(
  'should not capture content when `ai_monitoring.record_content.enabled` is false',
  async (t) => {
    const { agent } = t.context
    agent.config.ai_monitoring.record_content.enabled = false
    const event = new LlmChatCompletionMessage(t.context)
    t.equal(event.content, undefined, 'content should be empty')
  }
)
