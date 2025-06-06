/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()
module.exports = responses

responses.set('Invalid API key.', {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'x-request-id': '4f8f61a7d0401e42a6760ea2ca2049f6'
  },
  code: 401,
  body: {
    error: {
      message:
        'Incorrect API key provided: invalid. You can find your API key at https://platform.openai.com/account/api-keys.',
      type: 'invalid_request_error',
      param: 'null',
      code: 'invalid_api_key'
    }
  }
})

responses.set('Embedded: Invalid API key.', {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'x-request-id': '4f8f61a7d0401e42a6760ea2ca2049f6'
  },
  code: 401,
  body: {
    error: {
      message:
        'Incorrect API key provided: DEADBEEF. You can find your API key at https://platform.openai.com/account/api-keys.',
      type: 'invalid_request_error',
      param: 'null',
      code: 'invalid_api_key'
    }
  }
})

responses.set('Model does not exist.', {
  headers: {
    'Content-Type': 'application/json',
    'x-request-id': 'cfdf51fb795362ae578c12a21796262c'
  },
  code: 404,
  body: {
    error: {
      message: 'The model `does-not-exist` does not exist',
      type: 'invalid_request_error',
      param: 'null',
      code: 'model_not_found'
    }
  }
})

responses.set('This is an embedding test.', {
  headers: {
    'Content-Type': 'application/json',
    'openai-organization': 'new-relic-nkmd8b',
    'openai-processing-ms': '54',
    'openai-version': '2020-10-01',
    'x-ratelimit-limit-requests': '200',
    'x-ratelimit-limit-tokens': '150000',
    'x-ratelimit-remaining-requests': '197',
    'x-ratelimit-remaining-tokens': '149994',
    'x-ratelimit-reset-requests': '19m45.394s',
    'x-ratelimit-reset-tokens': '2ms',
    'x-request-id': 'c70828b2293314366a76a2b1dcb20688'
  },
  code: 200,
  body: {
    data: [
      {
        // a small sample of a real embedding response
        embedding: [-0.021616805, 0.004173375, 0.002796262, 0.004489489, -0.004940119],
        index: 0,
        object: 'embedding'
      }
    ],
    model: 'text-embedding-ada-002-v2',
    object: 'list',
    usage: { prompt_tokens: 6, total_tokens: 6 }
  }
})

responses.set('You are a scientist.', {
  headers: {
    'Content-Type': 'application/json',
    'openai-model': 'gpt-3.5-turbo-0613',
    'openai-organization': 'new-relic-nkmd8b',
    'openai-processing-ms': '1469',
    'openai-version': '2020-10-01',
    'x-ratelimit-limit-requests': '200',
    'x-ratelimit-limit-tokens': '40000',
    'x-ratelimit-remaining-requests': '199',
    'x-ratelimit-remaining-tokens': '39940',
    'x-ratelimit-reset-requests': '7m12s',
    'x-ratelimit-reset-tokens': '90ms',
    'x-request-id': '49dbbffbd3c3f4612aa48def69059ccd'
  },
  code: 200,
  body: {
    choices: [
      {
        finish_reason: 'stop',
        index: 0,
        message: {
          content: '212 degrees Fahrenheit is equal to 100 degrees Celsius.',
          role: 'assistant'
        }
      }
    ],
    created: 1696888863,
    id: 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTemv',
    model: 'gpt-3.5-turbo-0613',
    object: 'chat.completion',
    usage: { completion_tokens: 11, prompt_tokens: 53, total_tokens: 64 }
  }
})

responses.set('You are a mathematician.', {
  headers: {
    'Content-Type': 'application/json',
    'openai-model': 'gpt-3.5-turbo-0613',
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
    choices: [
      {
        finish_reason: 'stop',
        index: 0,
        message: {
          content: '1 plus 2 is 3.',
          role: 'assistant'
        }
      }
    ],
    created: 1696888865,
    id: 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat',
    model: 'gpt-3.5-turbo-0613',
    object: 'chat.completion',
    usage: { completion_tokens: 11, prompt_tokens: 53, total_tokens: 64 }
  }
})

responses.set('Invalid role.', {
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
        "'bad-role' is not one of ['system', 'assistant', 'user', 'function'] - 'messages.0.role'",
      type: 'invalid_request_error',
      param: null,
      code: null
    }
  }
})

responses.set('Embedding not allowed.', {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'x-request-id': '25e22d5a7af9e40b7d5b1828593b52aa'
  },
  code: 403,
  body: {
    error: {
      message: 'You are not allowed to generate embeddings from this model',
      type: 'invalid_request_error',
      param: null,
      code: null
    }
  }
})

responses.set('Streamed response', {
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

responses.set('bad stream', {
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
