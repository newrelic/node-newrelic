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
const LlmEvent = require('../../../../lib/llm-events/aws-bedrock/event')

test.beforeEach((ctx) => {
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
                  'llm.conversation_id': 'conversation-1',
                  omit: 'me'
                }
              }
            }
          }
        }
      }
    }
  }

  ctx.nr.transaction = {
    traceId: 'trace-1'
  }
  ctx.nr.segment = {
    id: 'segment-1'
  }

  ctx.nr.bedrockResponse = {
    requestId: 'request-1'
  }

  ctx.nr.bedrockCommand = {
    modelId: 'model-1'
  }
})

test('create creates a new instance', async (t) => {
  const event = new LlmEvent(t.nr)
  assert.ok(event)
  assert.match(event.id, /[a-z0-9]{7}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}/)
  assert.equal(event.vendor, 'bedrock')
  assert.equal(event.ingest_source, 'Node')
  assert.equal(event.appName, 'test-app')
  assert.equal(event.span_id, 'segment-1')
  assert.equal(event.trace_id, 'trace-1')
  assert.equal(event.request_id, 'request-1')
  assert.equal(event['response.model'], 'model-1')
  assert.equal(event['request.model'], 'model-1')
  assert.equal(event['request.max_tokens'], null)
  assert.equal(event['llm.conversation_id'], 'conversation-1')
  assert.equal(event.omit, undefined)
})

test('serializes the event', (t) => {
  const event = new LlmEvent(t.nr)
  event.serialize()
  assert.ok(!event.bedrockCommand)
  assert.ok(!event.bedrockResponse)
  assert.ok(!event.constructionParams)
})
