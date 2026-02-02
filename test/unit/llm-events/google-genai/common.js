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
  },
  // IRL, this is a getter that equates
  // to candidates[0].content.parts.text
  text: "I don't know!"
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
    trace_id: tx.traceId,
    span_id: spanId,
    vendor: 'gemini',
    ingest_source: 'Node',
    'response.model': 'gemini-2.0-flash',
  }
  const resKeys = {
    duration: child.getDurationInMillis()
  }

  switch (type) {
    case 'embedding':
      expected = {
        ...expected,
        ...resKeys,
        'request.model': 'gemini-2.0-flash',
      }
      expected.input = 'This is my test input'
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
        'request.model': 'gemini-2.0-flash',
      }
      break
    case 'message':
      expected = {
        ...expected,
        content: 'Why is the sky blue?',
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
