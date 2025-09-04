/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// These are the mock variables for the `openai.responses.create` API.
const res = {
  headers: {
    'x-request-id': 'req-id',
    'openai-version': '1.0.0',
    'openai-organization': 'new-relic',
    'x-ratelimit-limit-requests': '100',
    'x-ratelimit-limit-tokens': '100',
    'x-ratelimit-reset-tokens': '100',
    'x-ratelimit-remaining-tokens': '10',
    'x-ratelimit-remaining-requests': '10'
  },
  model: 'gpt-4-0613',
  usage: {
    total_tokens: 30,
    input_tokens: 10,
    output_tokens: 20
  }
}

const chatRes = {
  headers: {
    'x-request-id': 'req-id',
    'openai-version': '1.0.0',
    'openai-organization': 'new-relic',
    'x-ratelimit-limit-requests': '100',
    'x-ratelimit-limit-tokens': '100',
    'x-ratelimit-reset-tokens': '100',
    'x-ratelimit-remaining-tokens': '10',
    'x-ratelimit-remaining-requests': '10'
  },
  model: 'gpt-4-0613',
  id: 'resp_id',
  temperature: 1,
  max_output_tokens: 1000000,
  status: 'completed',
  object: 'response',
  output: [{ id: 'msg_id', role: 'assistant', status: 'completed', content: [{ text: 'a lot' }] }],
  output_text: 'a lot',
  usage: {
    total_tokens: 30,
    prompt_tokens: 10,
    completion_tokens: 20
  }
}

const req = {
  model: 'gpt-4',
  max_output_tokens: 1000000,
  temperature: 1,
  input: 'What is a woodchuck?',
}

function getExpectedResult(tx, event, type, completionId) {
  const trace = tx.trace.root
  const [child] = tx.trace.getChildren(trace.id)
  const spanId = child.id
  let expected = {
    id: event.id,
    appName: 'New Relic for Node.js tests',
    request_id: 'req-id',
    trace_id: tx.traceId,
    span_id: spanId,
    'response.model': 'gpt-4-0613',
    vendor: 'openai',
    ingest_source: 'Node'
  }
  const resKeys = {
    duration: child.getDurationInMillis(),
    'request.model': 'gpt-4',
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
      expected['response.usage.total_tokens'] = 30
      break
    case 'summary':
      expected = {
        ...expected,
        ...resKeys,
        'request.max_tokens': 1000000,
        'request.temperature': 1,
        'response.number_of_messages': 2,
        'response.choices.finish_reason': 'completed',
        'response.usage.prompt_tokens': 10,
        'response.usage.completion_tokens': 20,
        'response.usage.total_tokens': 30,
        error: false
      }
      break
    case 'message':
      expected = {
        ...expected,
        content: 'What is a woodchuck?',
        role: 'user',
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
  chatRes,
  getExpectedResult
}
