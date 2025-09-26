/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// These are the mock variables for the `openai.chat.completions.create` API.
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
  model: 'gpt-3.5-turbo-0613',
  usage: {
    total_tokens: '30',
    input_tokens: '10',
    output_tokens: '20'
  }
}

const chatRes = {
  ...res,
  id: 'res-id',
  choices: [{ finish_reason: 'stop', message: { content: 'a lot', role: 'know-it-all' } }],
  usage: {
    ...res.usage,
    prompt_tokens: 10,
    completion_tokens: 20
  }
}

const req = {
  model: 'gpt-3.5-turbo-0613',
  max_tokens: '1000000',
  temperature: 'medium-rare',
  messages: [
    { content: 'What is a woodchuck?', role: 'inquisitive-kid' },
    {
      content: 'How much would could a woodchuck chuck if a woodchuck could chuck wood?',
      role: 'inquisitive-kid'
    }
  ]
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
    'response.model': 'gpt-3.5-turbo-0613',
    vendor: 'openai',
    ingest_source: 'Node'
  }
  const resKeys = {
    duration: child.getDurationInMillis(),
    'request.model': 'gpt-3.5-turbo-0613',
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
      expected = {
        ...expected,
        ...resKeys,
        error: false,
        'response.usage.prompt_tokens': 10,
        'response.usage.completion_tokens': 20,
        'response.usage.total_tokens': 30,
      }
      expected.input = 'This is my test input'
      expected.error = false
      break
    case 'summary':
      expected = {
        ...expected,
        ...resKeys,
        'request.max_tokens': '1000000',
        'request.temperature': 'medium-rare',
        'response.number_of_messages': 3,
        'response.choices.finish_reason': 'stop',
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
        role: 'inquisitive-kid',
        sequence: 0,
        completion_id: completionId,
        is_response: false,
        token_count: 0
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
