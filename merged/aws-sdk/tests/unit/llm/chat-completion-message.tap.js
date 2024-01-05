/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LlmChatCompletionMessage = require('../../../lib/llm/chat-completion-message')

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

  t.context.credentials = {
    accessKeyId: '123456789'
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
    isCohere() {
      return false
    },
    isTitan() {
      return false
    }
  }
})

tap.test('create creates a non-response instance', async (t) => {
  const event = new LlmChatCompletionMessage(t.context)
  t.equal(event.is_response, false)
  t.equal(event.conversation_id, 'conversation-1')
  t.equal(event.completion_id, 'completion-1')
  t.equal(event.sequence, 0)
  t.equal(event.content, 'who are you')
  t.equal(event.role, 'user')
  t.match(event.id, /[\w-]{36}/)
})

tap.test('create creates a titan response instance', async (t) => {
  t.context.bedrockCommand.isTitan = () => true
  t.context.content = 'a response'
  t.context.isResponse = true
  const event = new LlmChatCompletionMessage(t.context)
  t.equal(event.is_response, true)
  t.equal(event.conversation_id, 'conversation-1')
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
  t.equal(event.conversation_id, 'conversation-1')
  t.equal(event.completion_id, 'completion-1')
  t.equal(event.sequence, 0)
  t.equal(event.content, 'a response')
  t.equal(event.role, 'assistant')
  t.match(event.id, /42-0/)
})
