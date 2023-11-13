/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LlmFeedbackMessage = require('../../../../lib/llm-events/openai/feedback-message')

tap.test('LlmFeedbackMessage', (t) => {
  const opts = {
    conversationId: 'convo-id',
    requestId: 'request-id',
    messageId: 'msg-id',
    category: 'informative',
    rating: '10',
    message: 'This answer was amazing'
  }
  const feedbackMsg = new LlmFeedbackMessage(opts)
  const serialized = feedbackMsg.serialize()
  const expected = `{"id":"${feedbackMsg.id}","conversation_id":"convo-id","request_id":"request-id","message_id":"msg-id","category":"informative","rating":"informative","message":"This answer was amazing","ingest_source":"Node"}`
  t.same(serialized, JSON.parse(expected))
  t.end()
})
