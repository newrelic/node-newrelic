/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const res = {
  id: 'msg_test123',
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-4-20250514',
  content: [{ type: 'text', text: '1 plus 2 is 3.' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 53, output_tokens: 11 }
}

const req = {
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  temperature: 0.5,
  messages: [
    { role: 'user', content: 'What does 1 plus 2 equal?' }
  ]
}

function getExpectedResult(tx, event, type, completionId) {
  const trace = tx.trace.root
  const [child] = tx.trace.getChildren(trace.id)
  const spanId = child.id
  let expected = {
    id: event.id,
    trace_id: tx.traceId,
    span_id: spanId,
    vendor: 'anthropic',
    ingest_source: 'Node',
    'response.model': 'claude-sonnet-4-20250514',
  }
  const resKeys = {
    duration: child.getDurationInMillis()
  }

  switch (type) {
    case 'summary':
      expected = {
        ...expected,
        ...resKeys,
        'request.max_tokens': 1024,
        'request.temperature': 0.5,
        'request.model': 'claude-sonnet-4-20250514',
        'response.number_of_messages': 2,
        'response.choices.finish_reason': 'end_turn',
        'response.usage.prompt_tokens': 53,
        'response.usage.completion_tokens': 11,
        'response.usage.total_tokens': 64,
      }
      break
    case 'message':
      expected = {
        ...expected,
        content: 'What does 1 plus 2 equal?',
        sequence: 0,
        completion_id: completionId,
        role: 'user',
        token_count: 0
      }
  }

  return expected
}

module.exports = {
  req,
  res,
  getExpectedResult
}
