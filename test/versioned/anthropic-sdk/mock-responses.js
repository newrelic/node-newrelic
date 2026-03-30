/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()
module.exports = responses

responses.set('Invalid API key.', {
  code: 401,
  body: {
    type: 'error',
    error: {
      type: 'authentication_error',
      message: 'invalid x-api-key'
    }
  }
})

responses.set('You are a mathematician.', {
  code: 200,
  body: {
    id: 'msg_test123',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-20250514',
    content: [{ type: 'text', text: '1 plus 2 is 3.' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 53, output_tokens: 11 }
  }
})

responses.set('You are a scientist.', {
  code: 200,
  body: {
    id: 'msg_test456',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-20250514',
    content: [{ type: 'text', text: '212 degrees Fahrenheit is equal to 100 degrees Celsius.' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 53, output_tokens: 11 }
  }
})

responses.set('Streamed response', {
  code: 200,
  body: [
    {
      type: 'message_start',
      message: {
        id: 'msg_stream123',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [],
        stop_reason: null,
        usage: { input_tokens: 53, output_tokens: 0 }
      }
    },
    {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' }
    },
    {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'A streamed response is a way of ' }
    },
    {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'transmitting data continuously.' }
    },
    {
      type: 'content_block_stop',
      index: 0
    },
    {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 11 }
    },
    {
      type: 'message_stop'
    }
  ]
})

responses.set('bad stream', {
  code: 200,
  body: 'error'
})
