/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const errorChunk = {
  response: {
    message: 'fetch failed',
    stack: 'TypeError: fetch failed',
    cause: {
      code: 'BAD_STREAM',
      reason: 'internal error',
      library: 'opeani',
    }
  }
}

const chunks = []
// Setup chunks
chunks.push({
  response: {
    id: 'resp_684886977be881928c9db234e14ae7d80f8976796514dff9',
    model: 'gpt-4-0613',
    object: 'response',
    status: 'in_progress',
    output: []
  },
  type: 'response.created',
  sequence_number: 0
})

chunks.push({
  response: {
    id: 'resp_684886977be881928c9db234e14ae7d80f8976796514dff9',
    model: 'gpt-4-0613',
    object: 'response',
    status: 'in_progress',
    output: []
  },
  type: 'response.in_progress',
  sequence_number: 1
})

chunks.push({
  item: {
    id: 'msg_68488698f6088192a505b70393c560bc0f8976796514dff9',
    role: 'assistant',
    status: 'in_progress',
    type: 'message'
  },
  output_index: 0,
  type: 'response.output_item.added',
  sequence_number: 2
})

chunks.push({
  part: {
    type: 'output_text',
    text: ''
  },
  content_index: 0,
  output_index: 0,
  item_id: 'msg_68488698f6088192a505b70393c560bc0f8976796514dff9',
  type: 'response.content_part.added',
  sequence_number: 3
})

// Delta chunks for the actual text
chunks.push({
  content_index: 0,
  delta: 'Test',
  item_id: 'msg_68488698f6088192a505b70393c560bc0f8976796514dff9',
  output_index: 0,
  sequence_number: 4,
  type: 'response.output_text.delta',
})

chunks.push({
  content_index: 0,
  delta: 'stream',
  item_id: 'msg_68488698f6088192a505b70393c560bc0f8976796514dff9',
  output_index: 0,
  sequence_number: 5,
  type: 'response.output_text.delta',
})

// Finishing up - summing deltas together
chunks.push({
  content_index: 0,
  item_id: 'msg_68488698f6088192a505b70393c560bc0f8976796514dff9',
  output_index: 0,
  sequence_number: 6,
  text: 'Test stream',
  type: 'response.output_text.done',
})

chunks.push({
  content_index: 0,
  item_id: 'msg_68488698f6088192a505b70393c560bc0f8976796514dff9',
  output_index: 0,
  part: {
    type: 'output_text',
    text: 'Test stream'
  },
  sequence_number: 7,
  type: 'response.content_part.done',
})

chunks.push({
  item: {
    content: [{
      text: 'Test stream',
      type: 'output_text'
    }],
    id: 'msg_68488698f6088192a505b70393c560bc0f8976796514dff9',
    role: 'assistant',
    status: 'completed',
    type: 'message'
  },
  output_index: 0,
  sequence_number: 8,
  type: 'response.output_item.done',
})

chunks.push({
  response: {
    id: 'resp_684886977be881928c9db234e14ae7d80f8976796514dff9',
    model: 'gpt-4-0613',
    object: 'response',
    output: [{
      content: [{ text: 'Test stream' }],
      id: 'msg_68488698f6088192a505b70393c560bc0f8976796514dff9',
      role: 'assistant',
      status: 'completed',
      type: 'message'
    }],
    status: 'completed',
    usage: {
      // This is incorrect for this specific stream
      // example, but matches other mock responses,
      // so we can use it for testing.
      input_tokens: 11,
      output_tokens: 53,
      total_tokens: 64
    },
  },
  sequence_number: 9,
  type: 'response_completed',
})

module.exports = { chunks, errorChunk }
