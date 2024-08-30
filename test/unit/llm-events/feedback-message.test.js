/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmFeedbackMessage = require('../../../lib/llm-events/feedback-message')

test('LlmFeedbackMessage', () => {
  const opts = {
    traceId: 'trace-id',
    category: 'informative',
    rating: '10',
    message: 'This answer was amazing'
  }
  const feedbackMsg = new LlmFeedbackMessage(opts)
  const expected = {
    id: feedbackMsg.id,
    trace_id: 'trace-id',
    category: 'informative',
    rating: '10',
    message: 'This answer was amazing',
    ingest_source: 'Node'
  }
  assert.equal(feedbackMsg.id, expected.id)
  assert.equal(feedbackMsg.trace_id, expected.trace_id)
  assert.equal(feedbackMsg.category, expected.category)
  assert.equal(feedbackMsg.rating, expected.rating)
  assert.equal(feedbackMsg.message, expected.message)
  assert.equal(feedbackMsg.ingest_source, expected.ingest_source)
})
