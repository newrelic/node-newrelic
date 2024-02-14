/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const {
  DESTINATIONS: { TRANS_SCOPE }
} = require('../../../lib/util')
const LlmEmbedding = require('../../../lib/llm/embedding')

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

  t.context.bedrockCommand = {
    prompt: 'who are you'
  }

  t.context.bedrockResponse = {
    headers: {
      'x-amzn-requestid': 'request-1'
    },
    inputTokenCount: 0
  }
  t.context.segment = {
    transaction: { id: '1', traceId: 'id' },
    getDurationInMillis() {
      return 1.008
    }
  }
})

tap.test('creates a basic embedding', async (t) => {
  const event = new LlmEmbedding(t.context)
  t.equal(event.input, 'who are you')
  t.equal(event.duration, 1.008)
  t.equal(event['response.usage.total_tokens'], 0)
  t.equal(event['response.usage.prompt_tokens'], 0)
})
