/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const {
  DESTINATIONS: { TRANS_SCOPE }
} = require('../../../../lib/config/attribute-filter')
const LlmEvent = require('../../../../lib/llm-events/aws-bedrock/event')

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
                  ['llm.conversation_id']: 'conversation-1',
                  omit: 'me'
                }
              }
            }
          }
        }
      }
    }
  }

  t.context.segment = {
    id: 'segment-1',
    transaction: {
      traceId: 'trace-1'
    }
  }

  t.context.bedrockResponse = {
    requestId: 'request-1'
  }

  t.context.bedrockCommand = {
    modelId: 'model-1'
  }
})

tap.test('create creates a new instance', async (t) => {
  const event = new LlmEvent(t.context)
  t.ok(event)
  t.match(event.id, /[a-z0-9]{7}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}/)
  t.equal(event.vendor, 'bedrock')
  t.equal(event.ingest_source, 'Node')
  t.equal(event.appName, 'test-app')
  t.equal(event.span_id, 'segment-1')
  t.equal(event.trace_id, 'trace-1')
  t.equal(event.request_id, 'request-1')
  t.equal(event['response.model'], 'model-1')
  t.equal(event['request.model'], 'model-1')
  t.equal(event['request.max_tokens'], null)
  t.equal(event['llm.conversation_id'], 'conversation-1')
  t.equal(event.omit, undefined)
})

tap.test('serializes the event', (t) => {
  const event = new LlmEvent(t.context)
  event.serialize()
  t.notOk(event.bedrockCommand)
  t.notOk(event.bedrockResponse)
  t.notOk(event.constructionParams)
  t.end()
})
