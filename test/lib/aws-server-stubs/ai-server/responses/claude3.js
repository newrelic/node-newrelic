/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()
const { contentType, reqId } = require('./constants')

responses.set('text claude3 ultimate question', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-invocation-latency': '926',
    'x-amzn-bedrock-output-token-count': '36',
    'x-amzn-bedrock-input-token-count': '14'
  },
  statusCode: 200,
  body: {
    id: 'msg_bdrk_019V7ABaw8ZZZYuRDSTWK7VE',
    type: 'message',
    role: 'assistant',
    model: 'claude-3-haiku-20240307',
    stop_sequence: null,
    usage: { input_tokens: 30, output_tokens: 265 },
    content: [
      {
        type: 'text',
        text: '42'
      }
    ],
    stop_reason: 'endoftext'
  }
})

responses.set('text claude3 ultimate question streamed', {
  headers: {
    'content-type': 'application/vnd.amazon.eventstream',
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-content-type': contentType
  },
  statusCode: 200,
  // Please do not simplify the set of chunks. This set represents a minimal
  // streaming response from the "Messages API". Such a stream is different from
  // the other streamed responses, and we need an example of what a Messages API
  // stream looks like.
  chunks: [
    {
      body: {
        type: 'message_start',
        message: {
          content: [],
          id: 'msg_bdrk_sljfaofk',
          model: 'claude-3-sonnet-20240229',
          role: 'assistant',
          stop_reason: null,
          stop_sequence: null,
          type: 'message',
          usage: {
            input_tokens: 30,
            output_tokens: 1
          }
        }
      },
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      }
    },
    {
      body: {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' }
      },
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      }
    },
    {
      body: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: '42' }
      },
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      }
    },
    {
      body: {
        type: 'content_block_stop',
        index: 0
      },
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      }
    },
    {
      body: {
        type: 'message_delta',
        usage: { output_tokens: 1 },
        delta: {
          // The actual reason from the API will be `max_tokens` if the maximum
          // allowed tokens have been reached. But our tests expect "endoftext".
          stop_reason: 'endoftext',
          stop_sequence: null
        }
      },
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      }
    },
    {
      body: {
        type: 'message_stop',
        ['amazon-bedrock-invocationMetrics']: {
          inputTokenCount: 8,
          outputTokenCount: 4,
          invocationLatency: 511,
          firstByteLatency: 358
        }
      },
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      }
    }
  ]
})

responses.set('text claude3 ultimate question error', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': reqId,
    'x-amzn-errortype': 'ValidationException:http://internal.amazon.com/coral/com.amazon.bedrock/'
  },
  statusCode: 400,
  body: {
    message:
      'Malformed input request: 2 schema violations found, please reformat your input and try again.'
  }
})

module.exports = responses
