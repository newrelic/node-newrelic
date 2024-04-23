/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const responses = new Map()
const { contentType, reqId } = require('./constants')

responses.set('text llama2 ultimate question', {
  headers: {
    'content-type': contentType,
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-invocation-latency': 9677,
    'x-amzn-bedrock-output-token-count': 4,
    'x-amzn-bedrock-input-token-count': 8
  },
  statusCode: 200,
  body: {
    generation: '42',
    prompt_token_count: 14,
    generation_token_count: 205,
    stop_reason: 'endoftext'
  }
})

responses.set('text llama2 ultimate question streamed', {
  headers: {
    'content-type': 'application/vnd.amazon.eventstream',
    'x-amzn-requestid': reqId,
    'x-amzn-bedrock-content-type': contentType
  },
  statusCode: 200,
  chunks: [
    {
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      },
      body: {
        generation: '42',
        prompt_token_count: null,
        generation_token_count: 211,
        stop_reason: null
      }
    },
    {
      headers: {
        ':event-type': { type: 'string', value: 'chunk' },
        ':content-type': { type: 'string', value: 'application/json' },
        ':message-type': { type: 'string', value: 'event' }
      },
      body: {
        'generation': '',
        'prompt_token_count': null,
        'generation_token_count': 212,
        'stop_reason': 'endoftext',
        'amazon-bedrock-invocationMetrics': {
          inputTokenCount: 8,
          outputTokenCount: 4,
          invocationLatency: 9825,
          firstByteLatency: 283
        }
      }
    }
  ]
})

responses.set('text llama2 ultimate question error', {
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
