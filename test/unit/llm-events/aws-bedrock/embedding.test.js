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
const LlmEmbedding = require('../../../../lib/llm-events/aws-bedrock/embedding')

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
                  ['llm.conversation_id']: 'conversation-1'
                }
              }
            }
          }
        }
      }
    }
  }

  ctx.nr.bedrockCommand = {
    prompt: 'who are you'
  }

  ctx.nr.bedrockResponse = {
    headers: {
      'x-amzn-requestid': 'request-1'
    }
  }
  ctx.nr.segment = {
    transaction: { traceId: 'id' },
    getDurationInMillis() {
      return 1.008
    }
  }
})

test('creates a basic embedding', async (ctx) => {
  const event = new LlmEmbedding(ctx.nr)
  assert.equal(event.input, 'who are you')
  assert.equal(event.duration, 1.008)
  assert.equal(event.token_count, undefined)
})

test('should not capture input when `ai_monitoring.record_content.enabled` is false', async (ctx) => {
  const { agent } = ctx.nr
  agent.config.ai_monitoring.record_content.enabled = false
  const event = new LlmEmbedding(ctx.nr)
  assert.equal(event.input, undefined, 'input should be empty')
})

test('should capture token_count when callback is defined', async (ctx) => {
  ctx.nr.agent.llm.tokenCountCallback = () => 3
  const event = new LlmEmbedding(ctx.nr)
  assert.equal(event.token_count, 3)
})
