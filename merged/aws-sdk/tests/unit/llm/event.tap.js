/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LlmEvent = require('../../../lib/llm/event')

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

  t.context.segment = {
    id: 'segment-1',
    transaction: {
      id: 'tx-1',
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
  t.equal(event.api_key_last_four_digits, '6789')
  t.equal(event.span_id, 'segment-1')
  t.equal(event.transaction_id, 'tx-1')
  t.equal(event.trace_id, 'trace-1')
  t.equal(event.request_id, 'request-1')
  t.equal(event['response.model'], 'model-1')
  t.equal(event['request.model'], 'model-1')
  t.equal(event['request.max_tokens'], null)
})

tap.test('serializes the event', (t) => {
  const event = new LlmEvent(t.context)
  event.serialize()
  t.notOk(event.bedrockCommand)
  t.notOk(event.bedrockResponse)
  t.notOk(event.constructionParams)
  t.end()
})
