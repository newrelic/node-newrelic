/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const res = {
  modelVersion: 'gemini-2.0-flash',
  candidates: [
    {
      content: {
        parts: [
          { text: "I don't know!" }
        ],
        role: 'model'
      },
      finishReason: 'STOP'
    }
  ],
  usageMetadata: {
    promptTokenCount: 10,
    candidatesTokenCount: 20,
    totalTokenCount: 30
  }
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
    'request.model': 'gemini-2.0-flash',
    'response.model': 'gemini-2.0-flash',
    vendor: 'gemini',
    ingest_source: 'Node'
  }
  const resKeys = {
    duration: child.getDurationInMillis()
  }

  switch (type) {
    case 'embedding':
      expected = {
        ...expected,
        ...resKeys,
        'response.usage.total_tokens': 30,
      }
      expected.input = 'This is my test input'
      expected.error = false
      break
    case 'summary':
      expected = {
        ...expected,
        ...resKeys,
        'request.max_tokens': 1000000,
        'request.temperature': 1.0,
        'response.number_of_messages': 2,
        'response.choices.finish_reason': 'STOP',
        'response.usage.prompt_tokens': 10,
        'response.usage.completion_tokens': 20,
        'response.usage.total_tokens': 30,
        error: false
      }
      break
    case 'message':
      expected = {
        ...expected,
        content: 'Why is the sky blue?',
        sequence: 0,
        completion_id: completionId,
        is_response: false,
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
