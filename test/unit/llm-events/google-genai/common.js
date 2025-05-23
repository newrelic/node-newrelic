/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const res = {
  model: 'gemini-2.0-flash',
  choices: [{ finish_reason: 'stop', message: { content: 'a lot', role: 'know-it-all' } }]
}

const req = {
  model: 'gemini-2.0-flash',
  contents: 'Why is the sky blue?',
  config: {
    candidateCount: 1,
    stopSequences: ['x'],
    maxOutputTokens: 1000000,
    temperature: 1.0,
  },
}

function getExpectedResult(tx, event, type, completionId) {
  const trace = tx.trace.root
  const [child] = tx.trace.getChildren(trace.id)
  const spanId = child.id
  let expected = {
    id: event.id,
    appName: 'New Relic for Node.js tests',
    trace_id: tx.traceId,
    span_id: spanId,
    'response.model': 'gemini-2.0-flash',
    vendor: 'gemini',
    ingest_source: 'Node'
  }
  const resKeys = {
    duration: child.getDurationInMillis(),
    'request.model': 'gemini-2.0-flash',
    'response.organization': 'new-relic',
    'response.headers.llmVersion': '1.0.0',
    'response.headers.ratelimitLimitRequests': '100',
    'response.headers.ratelimitLimitTokens': '100',
    'response.headers.ratelimitResetTokens': '100',
    'response.headers.ratelimitRemainingTokens': '10',
    'response.headers.ratelimitRemainingRequests': '10'
  }

  switch (type) {
    case 'embedding':
      expected = { ...expected, ...resKeys }
      expected.input = 'This is my test input'
      expected.error = false
      expected.token_count = undefined
      break
    case 'summary':
      expected = {
        ...expected,
        ...resKeys,
        'request.max_tokens': '1000000',
        'request.temperature': '1.0',
        'response.number_of_messages': 3,
        'response.choices.finish_reason': 'stop',
        error: false
      }
      break
    case 'message':
      expected = {
        ...expected,
        content: 'Why is the sky blue?',
        sequence: 0,
        completion_id: completionId,
        is_response: false
      }
  }

  return expected
}

module.exports = {
  req,
  res,
  getExpectedResult
}
