/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()
module.exports = responses

responses.set('Invalid API key.', {
  headers: {},
  code: 401,
  body: {
    error: {
      message:
        '401 Incorrect API key provided: bad. You can find your API key at https://platform.openai.com/account/api-keys.',
      type: 'invalid_request_error',
      param: 'null',
      code: 'invalid_api_key',
      requestID: 'req_f3b1353d6a35554bcc6d6e0cbf07ad4b'
    }
  }
})

responses.set('Model does not exist.', {
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

responses.set('You are a mathematician.', {
  headers: {
    'content-type': 'application/json',
    'openai-organization': 'new-relic-nkmd8b',
    'openai-processing-ms': '770',
    'openai-version': '2020-10-01',
    'x-ratelimit-limit-requests': '10000',
    'x-ratelimit-limit-tokens': '1000000',
    'x-ratelimit-remaining-requests': '9999',
    'x-ratelimit-remaining-tokens': '999984',
    'x-ratelimit-reset-tokens': '0s',
    'x-request-id': 'req_dfcfcd9f6a176a36c7e386577161b792'
  },
  code: 200,
  body: {
    output: [
      {
        content: [{
          text: '1 plus 2 is 3.',
        }],
        role: 'assistant',
        status: 'completed',
      }
    ],
    created_at: 1749159322,
    id: 'resp_68420d9a5d4481a1bff5b86663299e3403b76731ee674f61',
    model: 'gpt-4-0613',
    object: 'response',
    usage: { input_tokens: 11, output_tokens: 53, total_tokens: 64 },
    output_text: '1 plus 2 is 3.',
    status: 'completed',
  },
})

responses.set('Invalid role.', {
  headers: {
    'content-type': 'application/json',
    'x-request-id': 'req_dfcfcd9f6a176a36c7e386577161b792',
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

// The last chunk event in a streamed response.
responses.set('Streamed response', {
  headers: {
    'content-type': 'text/event-stream; charset=utf-8',
    'openai-organization': 'new-relic-nkmd8b',
    'openai-processing-ms': '70',
    'openai-version': '2020-10-01',
    'transfer-encoding': 'chunked',
    'x-request-id': 'req_dfcfcd9f6a176a36c7e386577161b792'
  },
  code: 200,
  body: {
    type: 'response.completed',
    sequence_number: 100,
    response: {
      id: 'resp_68420d9a5d4481a1bff5b86663299e3403b76731ee674f61',
      object: 'response',
      created_at: 1749221320,
      model: 'gpt-4-0613',
      output: [{
        content: [{
          text: "A streamed response is a way of transmitting data from a server to a client (e.g. from a website to a user's computer or mobile device) in a continuous flow or stream, rather than all at one time. This means the client can start to process the data before all of it has been received, which can improve performance for large amounts of data or slow connections. Streaming is often used for real-time or near-real-time applications like video or audio playback.",
        }],
        role: 'assistant',
        status: 'completed',
        id: 'msg_6843007469bc8192af5e145250c297db0374f342293105d9',
      }]
    }
  },
  // For testing purposes only
  streamData: "A streamed response is a way of transmitting data from a server to a client (e.g. from a website to a user's computer or mobile device) in a continuous flow or stream, rather than all at one time. This means the client can start to process the data before all of it has been received, which can improve performance for large amounts of data or slow connections. Streaming is often used for real-time or near-real-time applications like video or audio playback.",
})

responses.set('bad stream', {
  headers: {
    'content-type': 'text/event-stream; charset=utf-8',
    'openai-organization': 'new-relic-nkmd8b',
    'openai-processing-ms': '70',
    'openai-version': '2020-10-01',
    'transfer-encoding': 'chunked',
    'x-request-id': 'req_dfcfcd9f6a176a36c7e386577161b792'
  },
  code: 200,
  body: {
    type: 'response.completed',
    sequence_number: 100,
    response: {
      id: 'resp_68420d9a5d4481a1bff5b86663299e3403b76731ee674f61',
      object: 'response',
      created_at: 1749221320,
      model: 'gpt-4-0613',
      output: [{
        content: [{
          text: 'do random',
        }],
        role: 'assistant',
        status: 'completed',
        id: 'msg_6843007469bc8192af5e145250c297db0374f342293105d9',
      }]
    },
  },
  streamData: 'do random' // For testing purposes only
})
