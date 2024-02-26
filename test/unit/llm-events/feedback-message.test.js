/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LlmFeedbackMessage = require('../../../lib/llm-events/feedback-message')

tap.test('LlmFeedbackMessage', (t) => {
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
  t.same(feedbackMsg, expected)
  t.end()
})
