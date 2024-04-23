/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const {
  DESTINATIONS: { TRANS_SCOPE }
} = require('../../../../lib/config/attribute-filter')
const LlmEmbedding = require('../../../../lib/llm-events/aws-bedrock/embedding')

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

  t.context.bedrockCommand = {
    prompt: 'who are you'
  }

  t.context.bedrockResponse = {
    headers: {
      'x-amzn-requestid': 'request-1'
    }
  }
  t.context.segment = {
    transaction: { traceId: 'id' },
    getDurationInMillis() {
      return 1.008
    }
  }
})

tap.test('creates a basic embedding', async (t) => {
  const event = new LlmEmbedding(t.context)
  t.equal(event.input, 'who are you')
  t.equal(event.duration, 1.008)
  t.equal(event.token_count, undefined)
})

tap.test(
  'should not capture input when `ai_monitoring.record_content.enabled` is false',
  async (t) => {
    const { agent } = t.context
    agent.config.ai_monitoring.record_content.enabled = false
    const event = new LlmEmbedding(t.context)
    t.equal(event.input, undefined, 'input should be empty')
  }
)

tap.test('should capture token_count when callback is defined', async (t) => {
  t.context.agent.llm.tokenCountCallback = () => 3
  const event = new LlmEmbedding(t.context)
  t.equal(event.token_count, 3)
})
