/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()
module.exports = responses

responses.set('Invalid API key 2', {
  headers: {},
  body: {}
})

responses.set('Model does not exist 2', {
  code: 400,
  body: {
    error: {
      message: "The requested model 'bad-model' does not exist.",
      type: 'invalid_request_error',
      param: 'model',
      code: 'model_not_found'
    }
  }
})

responses.set('You are a scientist.', {
  headers: {
    'content-type': 'application/json',
    'openai-organization': 'new-relic-nkmd8b',
    'openai-processing-ms': '770',
    'openai-version': '2020-10-01',
    'x-ratelimit-limit-requests': '10000',
    'x-ratelimit-limit-tokens': '1000000',
    'x-ratelimit-remaining-requests': '9999',
    'x-ratelimit-remaining-tokens': '999984',
    'x-ratelimit-reset-requests': '7m12s',
    'x-ratelimit-reset-tokens': '0s',
    'x-request-id': '"req_dfcfcd9f6a176a36c7e386577161b792"'
  },
  code: 200,
  body: {
    output: [
      {
        content: [{
          text: '212 degrees Fahrenheit is equal to 100 degrees Celsius.',
        }],
        role: 'assistant',
        status: 'completed',
      }
    ],
    created_at: 1749159322,
    id: 'resp_68420d9a5d4481a1bff5b86663299e3403b76731ee674f61',
    model: 'gpt-4-0613',
    object: 'response',
    usage: { input_tokens: 11, output_tokens: 53, total_tokens: 64 }
  }
})

responses.set('You are a wizard.', {
  headers: {
    'content-type': 'application/json',
    'openai-organization': 'new-relic-nkmd8b',
    'openai-processing-ms': '770',
    'openai-version': '2020-10-01',
    'x-ratelimit-limit-requests': '10000',
    'x-ratelimit-limit-tokens': '1000000',
    'x-ratelimit-remaining-requests': '9999',
    'x-ratelimit-remaining-tokens': '999984',
    'x-ratelimit-reset-requests': '7m12s',
    'x-ratelimit-reset-tokens': '0s',
    'x-request-id': '"req_dfcfcd9f6a176a36c7e386577161b792"'
  },
  code: 200,
  body: {
    output: [
      {
        content: [{
          text: '1 plus 2 is 3 .',
        }],
        role: 'assistant',
        status: 'completed',
      }
    ],
    created_at: 1749159322,
    id: 'resp_68420d9a5d4481a1bff5b86663299e3403b76731ee674f61',
    model: 'gpt-4-0613',
    object: 'response',
    usage: { input_tokens: 11, output_tokens: 53, total_tokens: 64 }
  }
})

responses.set('Invalid role 2', {
  headers: {
    'content-type': 'application/json',
    'x-request-id': '5db943f509e9031e73de8f4a5e46de32',
    'openai-organization': 'new-relic-nkmd8b',
    'openai-processing-ms': '4',
    'openai-version': '2020-10-01'
  },
  code: 400,
  body: {
    error: {
      message:
        "'bad-role' is not one of ['system', 'assistant', 'user', 'function', 'developer'] - 'messages.0.role'",
      type: 'invalid_request_error',
      param: null,
      code: null
    }
  }
})

responses.set('Streamed response 2', {
  headers: {
    'Content-Type': 'text/event-stream',
    'openai-model': 'gpt-4',
    'openai-organization': 'new-relic-nkmd8b',
    'openai-processing-ms': '1469',
    'openai-version': '2020-10-01',
    'x-ratelimit-limit-requests': '200',
    'x-ratelimit-limit-tokens': '40000',
    'x-ratelimit-remaining-requests': '199',
    'x-ratelimit-remaining-tokens': '39940',
    'x-ratelimit-reset-requests': '7m12s',
    'x-ratelimit-reset-tokens': '90ms',
    'x-request-id': '49dbbffbd3c3f4612aa48def69059aad'
  },
  code: 200,
  body: {
    id: 'chatcmpl-8MzOfSMbLxEy70lYAolSwdCzfguQZ',
    object: 'chat.completion.chunk',
    // 2023-11-20T09:00:00-05:00
    created: 1700488800,
    model: 'gpt-4',
    choices: [
      {
        delta: { role: 'assistant' },
        finish_reason: 'stop',
        index: 0
      }
    ]
  },
  streamData:
    "A streamed response is a way of transmitting data from a server to a client (e.g. from a website to a user's computer or mobile device) in a continuous flow or stream, rather than all at one time. This means the client can start to process the data before all of it has been received, which can improve performance for large amounts of data or slow connections. Streaming is often used for real-time or near-real-time applications like video or audio playback."
})

responses.set('bad stream 2', {
  headers: {
    'Content-Type': 'text/event-stream',
    'openai-model': 'gpt-4',
    'openai-organization': 'new-relic-nkmd8b',
    'openai-processing-ms': '1469',
    'openai-version': '2020-10-01',
    'x-ratelimit-limit-requests': '200',
    'x-ratelimit-limit-tokens': '40000',
    'x-ratelimit-remaining-requests': '199',
    'x-ratelimit-remaining-tokens': '39940',
    'x-ratelimit-reset-requests': '7m12s',
    'x-ratelimit-reset-tokens': '90ms',
    'x-request-id': '49dbbffbd3c3f4612aa48def69059aad'
  },
  code: 200,
  body: {
    id: 'chatcmpl-8MzOfSMbLxEy70lYAolSwdCzfguQZ',
    object: 'chat.completion.chunk',
    // 2023-11-20T09:00:00-05:00
    created: 1700488800,
    model: 'gpt-4',
    choices: [
      {
        delta: { role: 'assistant' },
        finish_reason: 'stop',
        index: 0
      }
    ]
  },
  streamData: 'do random'
})
